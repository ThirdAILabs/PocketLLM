import os
from functools import lru_cache

import yaml


@lru_cache
def get_settings():
    settings = dict()
    basedir = os.path.dirname(__file__)
    settings_path = os.path.join(basedir, "settings.yaml")
    if os.path.isfile(settings_path):
        with open("settings.yaml") as f:
            settings.update(yaml.load(f, Loader=yaml.FullLoader))
    return settings
