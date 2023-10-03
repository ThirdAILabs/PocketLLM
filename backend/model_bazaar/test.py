import json
import os
import shutil
import zipfile
from argparse import ArgumentParser
from pathlib import Path
from urllib.parse import urljoin

import requests
from tqdm import tqdm

from model_bazaar import clear_model, upload


class ModelBazaarTest:
    def __init__(self, url):
        self._url = url
        self._display_name = "Arbitary"
        self._local_direct_download = "./download_from_public"
        self._local_extracted_path = "./local_extracted"
        self._local_bazaar_download = "./download_from_modelzoo.zip"
        self._bazaar_extracted_path = "./bazaar_extracted"

    def download(self, url, local_path):
        response = requests.get(url, allow_redirects=True, stream=True)
        total_size_in_bytes = int(response.headers.get("content-length", 0))
        progress_bar = tqdm(total=total_size_in_bytes, unit="B", unit_scale=True)
        block_size = 4096 * 1024  # 4 MB
        with open(local_path, "wb") as file:
            for data in response.iter_content(block_size):
                file.write(data)
                progress_bar.update(len(data))

        progress_bar.close()

    def upload_model(self, local_path: Path):
        upload.upload(
            model_path=local_path,
            display_name=self._display_name,
            saved_name="test_case",
            trained_on="model bazaar",
        )

    def clear_entry(self):
        clear_model.clear_model(self._display_name)

    def check_hashes_match(self):
        hash_1 = upload.hash_path(Path(self._local_extracted_path))
        shutil.unpack_archive(
            filename=self._local_bazaar_download,
            extract_dir=self._bazaar_extracted_path,
        )
        hash_2 = upload.hash_path(Path(self._bazaar_extracted_path))
        if hash_1 != hash_2:
            raise ValueError("Downloaded one doesn't match with uploaded one")

    def remove_files(self):
        try:
            os.remove(self._local_bazaar_download)
            os.remove(self._local_direct_download)
            shutil.rmtree(Path(self._local_extracted_path))
            shutil.rmtree(Path(self._bazaar_extracted_path))
        except Exception as err:
            raise ValueError(
                f"Failed while deleting the files with following error {err}"
            )

    def extract_zip_file(self, zip_path, extracted_path):
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(extracted_path)

    def run(self):
        """
        Steps involved in this run
        1. Downloads the public available file(~4.5GB) to local path.
        2. Uploads the downloaded one to the model bazaar
        3. Downloads the uploaded one from model bazaar
        4. Checks whether uploaded and downloaded one matches.
        5. clear the entry from model bazaar
        6. Removes the downloaded files.
        """
        try:
            os.system(f"wget -t inf -c {self._url} -O {self._local_direct_download} ")
            self.extract_zip_file(
                self._local_direct_download, self._local_extracted_path
            )
            self.upload_model(Path(self._local_extracted_path))
            modelzoo_url = urljoin("https://model-zoo.azurewebsites.net/", "download")
            response = requests.get(
                modelzoo_url, params={"display_name": self._display_name}
            )
            download_url = json.loads(response.content)["url"]
            self.download(download_url, self._local_bazaar_download)
            self.check_hashes_match()
            self.clear_entry()
            self.remove_files()
        except Exception as err:
            raise ValueError(f"Failed with following {err}")


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument(
        "--file-url",
        type=str,
        help="Any public url which can be downloaded via wget.",
        default="https://archive.ics.uci.edu/static/public/34/diabetes.zip",
    )
    args = parser.parse_args()

    model_bazaar_test = ModelBazaarTest(args.file_url)
    model_bazaar_test.run()
