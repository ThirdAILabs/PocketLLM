import os
import re
import shutil
import zipfile
from argparse import ArgumentParser
from pathlib import Path

import requests
from thirdai import neural_db as ndb

from DB import models
from DB.db import get_session
from model_bazaar.utils import get_directory_size, hash_path, zip_folder
from storage import get_storage

PUBLIC = "public"
PROTECTED = "protected"
PRIVATE = "private"

"""
PUBLIC -  Available for everyone.
PROTECTED - Available only for people within organization.
PRIVATE - Available only for the author.
"""


def check(saved_path, model_hash):
    with get_session() as session:
        saved_path_entry = (
            session.query(models.ModelZoo)
            .filter(models.ModelZoo.saved_path == saved_path)
            .first()
        )

        if saved_path_entry:
            raise ValueError(
                f"There is already a model with this name, try with a different name."
            )

        hash_entry: models.ModelZoo = (
            session.query(models.ModelZoo)
            .filter(models.ModelZoo.hash == model_hash)
            .first()
        )

        if hash_entry:
            raise ValueError(f"This model is already added to database.")


def construct_saved_path(model_name: str, email: str):
    with get_session() as session:
        user: models.User = (
            session.query(models.User).filter(models.User.email == email).first()
        )

        if not user:
            raise ValueError("User is not registered.")

        assert re.match(
            r"^[\w-]+$", model_name
        ), "Model name should only contain alphanumeric characters, underscores, and hyphens"
        return f"{user.username}/{model_name}"


def upload(
    model_path: Path,
    model_name: str,
    trained_on: str,
    is_indexed: bool = False,
    access_level: str = "public",
    email: str = "yash@thirdai.com",
):
    storage = get_storage()

    db = ndb.NeuralDB.from_checkpoint(model_path)
    num_params = db._savable_state.model.model._get_model().numParams()

    zip_path = zip_folder(model_path)
    print("Model zip completed")

    saved_path = construct_saved_path(model_name=model_name, email=email)

    model_hash = hash_path(model_path)
    check(saved_path, model_hash)

    print("All checks successful")

    file = open(zip_path, "rb")
    storage.upload_large_file_stream(file, saved_path)

    print("File uploaded successfully.")

    size = get_directory_size(model_path)

    if access_level == PUBLIC:
        match_substr = ""
    elif access_level == PROTECTED:
        match_substr = "@thirdai.com"
    else:
        match_substr == email

    model_data = models.ModelZoo(
        name=model_name,
        saved_path=saved_path,
        trained_on=trained_on,
        num_params=num_params,
        size=size,
        hash=model_hash,
        is_indexed=is_indexed,
        access_level=access_level,
        match_substr=match_substr,
        author_email=email,
        domain=email.split("@")[1],
        author_username=saved_path.split("/")[0],
    )

    with get_session() as session:
        try:
            session.add(model_data)
            session.commit()
            session.refresh(model_data)
        except Exception as err:
            raise ValueError(
                f"Cannot add the model to database due to following error: {err}"
            )

    print("The following model data is added to database.")
    print(model_data.__repr__())

    # Delete the created zip file once done.
    os.remove(zip_path)


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument(
        "--model-path",
        type=Path,
        help="local model path to a folder.",
        required=True,
    )
    parser.add_argument(
        "--model-name",
        type=str,
        help="What name to display on playground.",
        required=True,
    )
    parser.add_argument(
        "--num-params",
        type=str,
        help="Num params in the model.",
        required=True,
    )
    parser.add_argument(
        "--trained-on", type=str, help="Trained on which datasets.", required=True
    )
    parser.add_argument(
        "--is-indexed",
        type=bool,
        help="whether we can directly use this for search",
        default=False,
    )
    parser.add_argument(
        "--access-level",
        type=str,
        help="one of public,private,protected",
        choices=[PUBLIC, PRIVATE, PROTECTED],
        default="public",
    )
    parser.add_argument(
        "--email",
        type=str,
        help="email of the person uploading the model",
        default="yash@thirdai.com",
    )
    args = parser.parse_args()

    upload(
        model_path=args.model_path,
        model_name=args.model_name,
        trained_on=args.trained_on,
        is_indexed=args.is_indexed,
        access_level=args.access_level,
        email=args.email,
    )
