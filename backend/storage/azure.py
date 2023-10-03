import os
import uuid
from datetime import datetime, timedelta

from azure.storage.blob import (
    BlobBlock,
    BlobSasPermissions,
    BlobServiceClient,
    generate_blob_sas,
)
from tqdm import tqdm


class AzureStorage:
    def __init__(self, account_name, account_key, container_name, cdn_name):
        self._account_name = account_name
        self._account_key = account_key
        connection_string = f"DefaultEndpointsProtocol=https;AccountName={account_name};AccountKey={account_key};EndpointSuffix=core.windows.net"
        self._container_name = container_name

        self._cdn_name = cdn_name

        self._blob_service_client = BlobServiceClient.from_connection_string(
            conn_str=connection_string
        )

        self._container_client = self._blob_service_client.get_container_client(
            container=container_name
        )

        self._fs_prefix = (
            f"https://{self._account_name}.blob.core.windows.net/{self._container_name}"
        )

        self._cdn_prefix = (
            f"https://{self._cdn_name}.azureedge.net/{self._container_name}"
        )

        if not self._container_client.exists():
            self._container_client.create_container()

    def generate_sas_token(self, relative_path, minutes=60):
        sas_permissions = BlobSasPermissions(read=True, write=True)
        sas_token = generate_blob_sas(
            account_name=self._account_name,
            container_name=self._container_name,
            blob_name=relative_path,
            account_key=self._account_key,
            permission=sas_permissions,
            # the link is valid for "minutes" min.
            expiry=datetime.utcnow() + timedelta(minutes=minutes),
        )

        return sas_token

    def url(self, relative_path, expiry=60):
        blob_path = os.path.join(self._fs_prefix, relative_path)

        sas_token = self.generate_sas_token(relative_path, minutes=expiry)

        return f"{blob_path}?{sas_token}"

    def cdn_url(self, relative_path):
        blob_path = os.path.join(self._cdn_prefix, relative_path)

        sas_token = self.generate_sas_token(relative_path)

        return f"{blob_path}?{sas_token}"

    def upload(self, file, destination_path):
        blob_client = self._container_client.get_blob_client(blob=destination_path)

        with open(file, "rb") as data:
            blob_client.upload_blob(data.read(), overwrite=True)

    def delete(self, destination_path):
        """
        deletes the file in azure storage.
        """
        blob = self._blob_service_client.get_blob_client(
            container=self._container_name, blob=destination_path
        )
        blob.delete_blob(delete_snapshots="include")

    def get_file_size(self, file_obj):
        current_position = (
            file_obj.tell()
        )  # Get the current position of the file pointer
        file_obj.seek(0, os.SEEK_END)  # Move the file pointer to the end of the file
        file_size = (
            file_obj.tell()
        )  # Get the current position of the file pointer (which is the file size)
        file_obj.seek(
            current_position, os.SEEK_SET
        )  # Move the file pointer back to the original position
        return file_size

    def upload_large_file_stream(self, file, destination):
        try:
            blob_client = self._container_client.get_blob_client(blob=destination)
            # upload data
            block_list = []
            chunk_size = 1024 * 1024 * 4
            progress_bar = tqdm(
                total=self.get_file_size(file), unit="B", unit_scale=True
            )

            while True:
                read_data = file.read(chunk_size)
                if not read_data:
                    break
                blk_id = str(uuid.uuid4())
                blob_client.stage_block(block_id=blk_id, data=read_data)
                block_list.append(BlobBlock(block_id=blk_id))
                progress_bar.update(len(read_data))

            progress_bar.close()
            blob_client.commit_block_list(block_list)
        except Exception as err:
            print("Upload file error")
            print(err)
