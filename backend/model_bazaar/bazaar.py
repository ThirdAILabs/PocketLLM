import json
import os
import pickle
import shutil
from pathlib import Path
from typing import Callable, List, Optional, Union
from urllib.parse import urljoin

import requests
from pydantic import BaseModel, ValidationError
from requests.auth import HTTPBasicAuth
from thirdai import neural_db as ndb
from tqdm import tqdm

from model_bazaar.utils import (
    get_directory_size,
    get_file_size,
    hash_path,
    http_get_with_error,
    http_post_with_error,
    upload_file,
    zip_folder,
)


class BazaarEntry(BaseModel):
    model_name: str
    trained_on: str
    num_params: int
    size: int
    size_in_memory: int
    hash: str
    identifier: str
    domain: str
    description: str = None
    is_indexed: bool = False
    publish_date: str
    author_email: str
    author_username: str
    access_level: str = "public"
    thirdai_version: str

    @staticmethod
    def from_dict(entry):
        return BazaarEntry(
            model_name=entry["model_name"],
            trained_on=entry["trained_on"],
            num_params=entry["num_params"],
            size=entry["size"],
            size_in_memory=entry["size_in_memory"],
            hash=entry["hash"],
            identifier=entry["saved_path"],
            domain=entry["domain"],
            description=entry["description"],
            is_indexed=entry["is_indexed"],
            publish_date=entry["publish_date"],
            author_email=entry["author_email"],
            author_username=entry["author_username"],
            access_level=entry["access_level"],
            thirdai_version=entry["thirdai_version"],
        )

    @staticmethod
    def bazaar_entry_from_json(json_entry):
        try:
            loaded_entry = BazaarEntry.from_dict(json_entry)
            return loaded_entry
        except ValidationError as e:
            print(f"Validation error: {e}")
            return None


class Login:
    def __init__(
        self,
        email: str,
        password: str,
        base_url: str = "https://staging-modelzoo.azurewebsites.net/api/",
    ):
        self._base_url = base_url
        # We are using HTTPBasic Auth in backend. update this when we change the Authentication in Backend.
        response = http_get_with_error(
            urljoin(self._base_url, "user/email-login"),
            auth=HTTPBasicAuth(email, password),
        )

        content = json.loads(response.content)
        self._access_token = content["data"]["access_token"]

        self._user_id = content["data"]["user"]["user_id"]

    @property
    def access_token(self):
        return self._access_token

    @property
    def user_id(self):
        return self._user_id

    @property
    def base_url(self):
        return self._base_url


def auth_header(access_token):
    return {
        "Authorization": f"Bearer {access_token}",
    }


def relative_path_depth(child_path: Path, parent_path: Path):
    child_path, parent_path = child_path.resolve(), parent_path.resolve()
    relpath = os.path.relpath(child_path, parent_path)
    if relpath == ".":
        return 0
    else:
        return 1 + relpath.count(os.sep)


# Use this decorator for any function to enforce users use only after login.
def login_required(func):
    def wrapper(self, *args, **kwargs):
        if not self.is_logged_in():
            raise PermissionError(
                "You have to login to use this functionality. try '.login()' method."
            )
        return func(self, *args, **kwargs)

    return wrapper


class Bazaar:
    def __init__(
        self,
        cache_dir: Union[Path, str] = Path("./bazaar_cache"),
        base_url="https://staging-modelzoo.azurewebsites.net/api/",
    ):
        cache_dir = Path(cache_dir)
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)
        self._cache_dir = cache_dir
        self._base_url = base_url
        self._login_instance = None

    def signup(self, email, password, username):
        json_data = {
            "username": username,
            "email": email,
            "password": password,
        }

        response = http_post_with_error(
            urljoin(self._base_url, "user/email-signup-basic"),
            json=json_data,
        )

        print(
            f"Successfully signed up. Please check your email ({email}) to verify your account."
        )

    def login(self, email, password):
        # This will try to login, if there is any error it will be throwed by Login class.
        login_instance = Login(email=email, password=password, base_url=self._base_url)

        self._login_instance = login_instance

    def is_logged_in(self):
        return self._login_instance != None

    def fetch(
        self,
        name: str = "",
        domain: Optional[str] = None,
        username: Optional[str] = None,
        access_level: Optional[List[str]] = None,
    ):
        if self.is_logged_in():
            url = urljoin(
                self._login_instance._base_url,
                f"bazaar/{self._login_instance._user_id}/list",
            )
            response = http_get_with_error(
                url,
                params={
                    "name": name,
                    "domain": domain,
                    "username": username,
                    "access_level": access_level,
                },
                headers=auth_header(self._login_instance._access_token),
            )
        else:
            print("Fetching public models, login to fetch all accessible models.")
            url = urljoin(
                self._base_url,
                "bazaar/public-list",
            )
            response = http_get_with_error(
                url,
                params={
                    "name": name,
                    "domain": domain,
                    "username": username,
                },
            )
        json_entries = json.loads(response.content)["data"]

        bazaar_entries = [
            BazaarEntry.bazaar_entry_from_json(json_entry)
            for json_entry in json_entries
            if json_entry
        ]
        return bazaar_entries

    def fetch_from_cache(
        self,
        name: str = "",
        domain: Optional[str] = None,
        username: Optional[str] = None,
        access_level: Optional[List[str]] = None,
        only_check_dir_exists: bool = False,
    ):
        bazaar_entries = []
        # Walk through the directories
        for dirpath, dirnames, filenames in os.walk(self._cache_dir):
            depth = relative_path_depth(
                child_path=Path(dirpath), parent_path=Path(self._cache_dir)
            )

            if depth == 2:
                # We're two levels in, which is the level of all checkpoint dirs
                split_path = dirpath.split(os.path.sep)
                model_name = split_path[-1]
                author_username = split_path[-2]

                identifier = f"{author_username}/{model_name}"
                with open(self._cached_model_metadata_path(identifier), "r") as f:
                    bazaar_entry = BazaarEntry.from_dict(json.load(f))

                if (
                    name.lower() in model_name.lower()
                    and (not username or username == author_username)
                    and (not domain or domain == bazaar_entry.domain)
                    and (not access_level or bazaar_entry.access_level in access_level)
                ):
                    try:
                        if self._model_dir_in_cache(
                            identifier=identifier,
                            fetched_bazaar_entry=bazaar_entry,
                            only_check_dir_exists=only_check_dir_exists,
                        ):
                            bazaar_entries.append(bazaar_entry)
                    except:
                        pass

                dirnames.clear()  # Don't descend any further

            elif depth > 2:
                # We're too deep, don't process this directory
                dirnames.clear()

        return bazaar_entries

    def list_model_names(self):
        return [entry.identifier for entry in self.fetch()]

    def get_neuraldb(
        self,
        model_name: str,
        author_username: str,
        on_progress: Callable = lambda *args, **kwargs: None,
        cancel_state: ndb.CancelState = ndb.CancelState(),
        disable_progress_bar: bool = False,
    ):
        model_dir = self.get_model_dir(
            model_name, author_username, on_progress, cancel_state, disable_progress_bar
        )
        return ndb.NeuralDB.from_checkpoint(checkpoint_path=model_dir)

    def get_model_dir(
        self,
        model_name: str,
        author_username: str,
        on_progress: Callable = lambda *args, **kwargs: None,
        cancel_state: ndb.CancelState = ndb.CancelState(),
        disable_progress_bar: bool = False,
    ):
        identifier = f"{author_username}/{model_name}"

        if self.is_logged_in():
            url = urljoin(
                self._login_instance._base_url,
                f"bazaar/{self._login_instance._user_id}/model",
            )
            response = http_get_with_error(
                url,
                params={"saved_path": identifier},
                headers=auth_header(self._login_instance._access_token),
            )
        else:
            url = urljoin(
                self._base_url,
                "bazaar/model",
            )
            response = http_get_with_error(
                url,
                params={"saved_path": identifier},
            )

        json_entry = json.loads(response.content)["data"]
        bazaar_entry = BazaarEntry.bazaar_entry_from_json(json_entry)

        cached_model_dir = self._model_dir_in_cache(
            identifier=identifier, fetched_bazaar_entry=bazaar_entry
        )
        if cached_model_dir:
            return cached_model_dir

        self._download(
            identifier,
            on_progress=on_progress,
            cancel_state=cancel_state,
            disable_progress_bar=disable_progress_bar,
        )
        if not cancel_state.is_canceled():
            return self._unpack_and_remove_zip(identifier)
        else:
            try:
                shutil.rmtree(self._cached_checkpoint_dir(identifier))
            except:
                pass
            return None

    # The checkpoint dir is cache_dir/author_username/model_name/
    # This is the parent directory for the three paths defined in the following methods
    def _cached_checkpoint_dir(self, identifier: str):
        return self._cache_dir / identifier

    # The ndb path is cache_dir/author_username/model_name/model.ndb
    def _cached_model_dir_path(self, identifier: str):
        return self._cached_checkpoint_dir(identifier) / "model.ndb"

    # The ndb zip download path is cache_dir/author_username/model_name/model.zip
    def _cached_model_zip_path(self, identifier: str):
        return self._cached_checkpoint_dir(identifier) / "model.zip"

    # The BazaarEntry json metadata path is cache_dir/author_username/model_name/metadata.json
    def _cached_model_metadata_path(self, identifier: str):
        return self._cached_checkpoint_dir(identifier) / "metadata.json"

    def _model_dir_in_cache(
        self,
        identifier: str,
        fetched_bazaar_entry: str,
        only_check_dir_exists: bool = False,
    ):
        cached_model_dir = self._cached_model_dir_path(identifier)
        if cached_model_dir.is_dir():
            if not only_check_dir_exists:
                hash_match = hash_path(cached_model_dir) == fetched_bazaar_entry.hash
                size_match = (
                    get_directory_size(cached_model_dir) == fetched_bazaar_entry.size
                )
                if hash_match and size_match:
                    return cached_model_dir
            else:
                return cached_model_dir
        return None

    def _unpack_and_remove_zip(self, identifier: str):
        zip_path = self._cached_model_zip_path(identifier)
        extract_dir = self._cached_model_dir_path(identifier)
        shutil.unpack_archive(filename=zip_path, extract_dir=extract_dir)
        os.remove(zip_path)
        return extract_dir

    def _download(
        self,
        identifier: str,
        on_progress: Callable,
        cancel_state: ndb.CancelState,
        disable_progress_bar: bool = False,
    ):
        if self.is_logged_in():
            signing_url = urljoin(
                self._login_instance._base_url,
                f"bazaar/{self._login_instance._user_id}/download",
            )
            signing_response = http_get_with_error(
                signing_url,
                params={"saved_path": identifier},
                headers=auth_header(self._login_instance._access_token),
            )
        else:
            signing_url = urljoin(
                self._base_url,
                f"bazaar/public-download",
            )
            signing_response = http_get_with_error(
                signing_url,
                params={"saved_path": identifier},
            )
        try:
            shutil.rmtree(self._cached_checkpoint_dir(identifier))
        except:
            pass
        os.makedirs(self._cached_checkpoint_dir(identifier))

        model_metadata = json.loads(signing_response.content)["data"]
        download_url = model_metadata["url"]
        model_metadata.pop("url", None)
        with open(self._cached_model_metadata_path(identifier), "w") as f:
            json.dump(model_metadata, f)

        destination = self._cached_model_zip_path(identifier)

        # Streaming, so we can iterate over the response.
        response = requests.get(download_url, allow_redirects=True, stream=True)
        total_size_in_bytes = int(response.headers.get("content-length", 0))
        block_size = 1024 * 1024 * 4  # 4MiB
        size_so_far = 0

        if disable_progress_bar:
            with open(destination, "wb") as file:
                for data in response.iter_content(block_size):
                    if cancel_state.is_canceled():
                        break
                    size_so_far += len(data)
                    on_progress(size_so_far / total_size_in_bytes)
                    file.write(data)
        else:
            with open(destination, "wb") as file, tqdm(
                total=total_size_in_bytes,
                unit="B",
                unit_scale=True,
                desc="Downloading",
                disable=disable_progress_bar,
            ) as progress_bar:
                for data in response.iter_content(block_size):
                    if cancel_state.is_canceled():
                        break
                    size_so_far += len(data)
                    on_progress(size_so_far / total_size_in_bytes)
                    file.write(data)
                    progress_bar.update(len(data))

        if cancel_state.is_canceled():
            try:
                shutil.rmtree(self._cached_checkpoint_dir(identifier))
            except:
                pass
        else:
            if size_so_far != total_size_in_bytes:
                raise ValueError("Failed to download.")

    @login_required
    def push(
        self,
        name: str,
        model_path: Union[Path, str],
        trained_on: str,
        is_indexed: bool = False,
        access_level: str = "public",
        description: str = None,
    ):
        model_path = Path(model_path)
        zip_path = zip_folder(model_path)

        model_hash = hash_path(model_path)

        model_response = http_get_with_error(
            urljoin(
                self._login_instance._base_url,
                f"bazaar/{self._login_instance._user_id}/model-check",
            ),
            headers=auth_header(self._login_instance._access_token),
            params={"hash": str(model_hash)},
        )

        model_content = json.loads(model_response.content)

        if model_content["data"]["model_present"]:
            raise ValueError("This model is already uploaded.")

        url_response = http_get_with_error(
            urljoin(
                self._login_instance._base_url,
                f"bazaar/{self._login_instance._user_id}/upload-url",
            ),
            headers=auth_header(self._login_instance._access_token),
            params={
                "name": name,
                "size": int(get_file_size(zip_path, "MB")),
            },
        )

        upload_url = json.loads(url_response.content)["data"]["url"]

        upload_file(upload_url, zip_path)

        db = ndb.NeuralDB.from_checkpoint(checkpoint_path=model_path)
        model = db._savable_state.model.model._get_model()
        num_params = model.num_params()
        thirdai_version = model.thirdai_version()

        size = get_directory_size(model_path)

        # TODO: Get actual size in memory when db is loaded
        # This is a temporary approximation of how much RAM a model will take.
        # Approximation comes from 4x explosion of weights in ADAM optimizer.
        udt_pickle = model_path / "model.pkl"
        documents_pickle = model_path / "documents.pkl"
        logger_pickle = model_path / "logger.pkl"
        size_in_memory = (
            os.path.getsize(udt_pickle) * 4
            + os.path.getsize(documents_pickle)
            + os.path.getsize(logger_pickle)
        )

        response = http_post_with_error(
            urljoin(
                self._login_instance._base_url,
                f"bazaar/{self._login_instance._user_id}/upload-info",
            ),
            headers=auth_header(self._login_instance._access_token),
            json={
                "name": name,
                "trained_on": trained_on,
                "num_params": num_params,
                "is_indexed": is_indexed,
                "size": size,
                "size_in_memory": size_in_memory,
                "hash": model_hash,
                "access_level": access_level,
                "description": description,
                "thirdai_version": thirdai_version,
            },
        )

        os.remove(zip_path)

    @login_required
    def delete(
        self,
        model_name: str,
        author_username: str,
    ):
        identifier = f"{author_username}/{model_name}"

        delete_response = http_post_with_error(
            urljoin(
                self._login_instance._base_url,
                f"bazaar/{self._login_instance._user_id}/delete",
            ),
            headers=auth_header(self._login_instance._access_token),
            json={
                "saved_path": identifier,
            },
        )

        print("Successfully deleted the model.")
