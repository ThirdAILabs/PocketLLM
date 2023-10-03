from settings import get_settings
from storage.azure import AzureStorage

settings = get_settings()
choice = settings["storage"]["choice"]
options = settings["storage"]["options"]


def get_storage():
    storage_settings = options[choice]
    if choice == "azure":
        return AzureStorage(
            storage_settings["name"],
            storage_settings["key"],
            storage_settings["container"],
            storage_settings["cdn_name"],
        )
    else:
        raise ValueError("Currently supported only Azure blob storage.")
