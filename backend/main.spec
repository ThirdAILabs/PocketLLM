# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.building.datastruct import Tree


a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

# Check this post: https://github.com/langchain-ai/langchain/issues/4547#issuecomment-1676403768
# change to Langchain package location
a.datas += Tree('/opt/homebrew/lib/python3.11/site-packages/langchain', prefix='langchain')

#### Add stopwords data from NLTK. Used in ./parsing_utils/summarize.py: from nltk.corpus import stopwords
# First make sure you download nltk's stopwords: 
# import nltk
# nltk.download('stopwords')
# Replace /Users/yecao/nltk_data/corpora/stopwords with your stopwords path
a.datas += Tree('/Users/yecao/nltk_data/corpora/stopwords', prefix='nltk_data/corpora/stopwords')

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
