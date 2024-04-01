# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.building.datastruct import Tree


a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['tzdata'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

# Check this post: https://github.com/langchain-ai/langchain/issues/4547#issuecomment-1676403768
# change to Langchain package location
a.datas += Tree('/opt/homebrew/lib/python3.11/site-packages/langchain', prefix='langchain')

# change to Langchain community package location
a.datas += Tree('/Users/yecao/anaconda3/envs/pllm/lib/python3.11/site-packages/langchain_community', prefix='langchain_community')

#### Add stopwords data from NLTK. Used in ./parsing_utils/summarize.py: from nltk.corpus import stopwords
# First make sure you download nltk's stopwords: 
# import nltk
# nltk.download('stopwords')
# Replace /Users/yecao/nltk_data/corpora/stopwords with your stopwords path
a.datas += Tree('/Users/yecao/nltk_data/corpora/stopwords', prefix='nltk_data/corpora/stopwords')

# Gmail oAuth authentication for gmail account
a.datas += [('client_secret_user_account.json', 'client_secret_user_account.json', 'DATA')]

# Gmail oAuth authentication for gmail mailbox
a.datas += [('client_secrets.json', 'client_secrets.json', 'DATA')]

# File license
a.datas += [('license_may_11_2024.serialized', 'license_may_11_2024.serialized', 'DATA')]

# Bundle GeneralQnA model into package
# Remeber to save {"domain": "public","author_username": "thirdai","model_name": "GeneralQnA"} to /data
# a.datas += Tree('data', prefix='data')

# Add trafilatura and trafilatura/settings.cfg
a.datas += Tree('/opt/homebrew/lib/python3.11/site-packages/trafilatura', prefix='trafilatura')

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='main',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='main',
)
