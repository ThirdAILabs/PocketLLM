####### To package this file, run "pyinstaller main.spec" #######

import os
import sys
import json
import hashlib
import asyncio
from fastapi import FastAPI, WebSocket, HTTPException, Response, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from typing import Optional, Tuple, List
from thirdai import neural_db as ndb
from thirdai.neural_db.documents import Reference
from model_bazaar.bazaar import Bazaar
from pathlib import Path
from qa_impls import OpenAI, UDTEmbedding
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
import pickle
import base64
from bs4 import BeautifulSoup
import re
import csv
from email import message_from_bytes
from retrying import retry
from email.header import decode_header
import requests
import shutil
from datetime import datetime
import io
from uuid import uuid4
from highlight import highlight_ref as hl
from shutil import move
from copy import deepcopy

import webbrowser
from urllib.parse import urlencode

import pandas as pd
from concurrent.futures import ThreadPoolExecutor
import multiprocessing

from thirdai import licensing
if getattr(sys, 'frozen', False):
    application_path = sys._MEIPASS
else:
    application_path = os.path.dirname(os.path.abspath(__file__))

license_path = os.path.join(application_path, 'license_may_11_2024.serialized')

licensing.set_path(license_path)

WORKING_FOLDER = Path(os.path.dirname(__file__)) / "data"
BAZAAR_CACHE = WORKING_FOLDER / "bazaar_cache"
BAZAAR_URL = "https://staging-modelzoo.azurewebsites.net/api/"

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

class Backend:
    def __init__(self):
        self.backend = ndb.NeuralDB(
            fhr=50_000, embedding_dimension=1024, extreme_output_dim=10_000
        )
        self.current_results: Optional[List[Reference]] = None
        self.current_query: Optional[str] = None
        self.bazaar = Bazaar(base_url=BAZAAR_URL, cache_dir=BAZAAR_CACHE)
        self.preferred_summary_model = None
        self.open_ai_api_key = None
        self.openai_summarizer = None
        self.thirdai_summarizer = None
        self.gmail_auth_services = {}
        self.gmail_query_switch = False
        self.outlook_access_token = None
        self.outlook_query_switch = False
    
    def reset_neural_db(self):
        self.backend = ndb.NeuralDB(
            fhr=50_000, embedding_dimension=1024, extreme_output_dim=10_000
        )

backend_instance: Backend = Backend()

def parse_prompt(query) -> Tuple[str, Optional[str]]:
    KEYWORD = "$PROMPT$"
    if KEYWORD not in query:
        return query, None

    split = list(map(str.strip, query.split(KEYWORD)))
    if len(split) > 2:
        raise ValueError(f"The {KEYWORD} keyword cannot appear more than once.")
    if split[0] == "":
        print(
            f"Found empty string before {KEYWORD} keyword. Using prompt as query..."
        )
        return split[1], split[1]
    return tuple(split)


@app.get("/get_cached_workspace_metajson")
def get_cached_workspace_metajson():
    USER_WORKSPACE_CACHE = WORKING_FOLDER / "user_workspace_cache"
    model_metadata_list = []

    # Walk through each folder in the user_workspace_cache
    if USER_WORKSPACE_CACHE.exists() and USER_WORKSPACE_CACHE.is_dir():
        for model_folder in USER_WORKSPACE_CACHE.iterdir():
            metadata_path = model_folder / 'metadata.json'
            
            # If metadata file exists, read its content
            if metadata_path.exists():
                with open(metadata_path, 'r') as meta_file:
                    metadata = json.load(meta_file)
                    model_metadata_list.append(metadata)
    
    return model_metadata_list

@app.get("/highlighted_pdf")
def highlighted_pdf(index: Optional[int] = Query(None)):
    global backend_instance

    # Check if index is provided and it's valid
    if index is None or index >= len(backend_instance.current_results):
        return {"error": "Invalid index provided"}

    reference_id = backend_instance.current_results[index].id
    reference = backend_instance.backend._savable_state.documents.reference(reference_id)

    buffer = io.BytesIO(hl.highlighted_pdf_bytes(reference))
    headers = {'Content-Disposition': f'inline; filename="{Path(reference.source).name}"'}
    return Response(buffer.getvalue(), headers=headers, media_type='application/pdf')

@app.websocket("/index_files")
async def index_files(websocket: WebSocket):
    await websocket.accept()

    global backend_instance

    # If previously trained on Gmail, reset neuraldb
    if backend_instance.gmail_query_switch:
        backend_instance.reset_neural_db()

    if backend_instance.outlook_query_switch:
        backend_instance.reset_neural_db()

    async for message in websocket.iter_text():
        data = json.loads(message)
        filePaths = data.get("filePaths", [])

        documents = []

        for path in filePaths:
            if path.lower().endswith(".pdf"):
                documents.append(ndb.PDF(path))
            elif path.lower().endswith(".docx"):
                documents.append(ndb.DOCX(path))
            elif path.lower().endswith(".csv"):
                documents.append(ndb.CSV(path))

        async def async_on_progress(fraction):
            progress = int(100 * fraction)
            message = "Indexing in progress"
            await websocket.send_json({"progress": progress, "message": message, "complete": False})

        def on_progress(fraction):
            loop.call_soon_threadsafe(asyncio.create_task, async_on_progress(fraction))

        def on_error(error_msg):
            loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"error": True, "message": error_msg}))

        def on_success():
            # Turn off Gmail query switch
            backend_instance.gmail_query_switch = False
            backend_instance.outlook_query_switch = False

            loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"progress": 100, "message": "Indexing completed", "complete": True}))

        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: backend_instance.backend.insert(
                sources=documents,
                on_progress=on_progress,
                on_error=on_error,
                on_success=on_success,
            ))
        except Exception as e:
            await websocket.send_json({"error": True, "message": str(e)})

class QueryModel(BaseModel):
    search_str: str

@app.post("/query")
def query(query_model: QueryModel):    
    global backend_instance

    # Handle the case when backend_instance is None
    if backend_instance is None:
        raise HTTPException(status_code=400, detail="Backend instance is not initialized")

    search_str = query_model.search_str

    backend_instance.current_query = search_str

    print(f'backend: searching "{search_str}"')

    query, _ = parse_prompt(search_str)

    references = backend_instance.backend.search(
        query=query, top_k=100, rerank = False
    )

    backend_instance.current_results = references

    results = []

    if backend_instance.gmail_query_switch:
        for ref in references:
            ref_text = ref.text

            email_content_index = ref_text.find("Email Content:")
            msg_id = ref_text[len('Message ID: '): email_content_index].strip()
            email_content = ref_text[email_content_index + len('Email Content:'):].strip()

            results.append({"result_type": "Gmail", "result_text": email_content, "result_source": f'https://mail.google.com/mail/u/0/?tab=rm&ogbl#inbox/{msg_id}'})
    elif backend_instance.outlook_query_switch:
        for ref in references:
            ref_text = ref.text

            email_content_index = ref_text.find("Email Content:")
            msg_id = ref_text[len('Message ID: '): email_content_index].strip()
            email_content = ref_text[email_content_index + len('Email Content:'):].strip()

            results.append({"result_type": "Outlook", "result_text": email_content, "result_source": f'https://outlook.live.com/mail/0/inbox/id/{msg_id}'})
    else:
        results = [
            {
                "result_type": "Non-Gmail",
                "result_text": ref.text,
                "result_source": ref.source,
                "page_low": ref.metadata.get("page", -1) + 1,
                "page_high": ref.metadata.get("page", -1) + 1,
            }
            for ref in references
        ]

    return results

class TeachModel(BaseModel):
    source_str: str
    target_str: str

@app.post("/teach")
def teach(teach_model: TeachModel):
    global backend_instance

    # Handle the case when backend_instance is None
    if backend_instance is None:
        raise HTTPException(status_code=400, detail="Backend instance is not initialized")

    source_str = teach_model.source_str
    target_str = teach_model.target_str

    print(f'backend: training association between "{source_str}" and "{target_str}"')

    try:
        references = backend_instance.backend.search(
            query=target_str, top_k=2
        )
        references.sort(key=lambda ref: ref._score)
        for reference in references:
            backend_instance.backend.text_to_result(source_str, reference.id)
    except Exception as error:
        return { 'success': False, 'msg': error }
    
    return { 'success': True, 'msg': 'associate success' }

class UpWeightModel(BaseModel):
    result_idx: int

@app.post("/upweight")
def upweight(up_weight_model: UpWeightModel):
    result_idx = up_weight_model.result_idx
    print(f"backend: upweighting result {result_idx}")

    try:
        element_id = backend_instance.current_results[result_idx].id
        backend_instance.backend.text_to_result(backend_instance.current_query, element_id)
        return  { 'success': True, 'msg': 'upweight success' }
    except Exception as error:
        return { 'success': False, 'msg': error }

class SaveModel(BaseModel):
    filePath: str

@app.post("/save")
def save(path: SaveModel):
    global backend_instance
    try:
        file_path = path.filePath
        print("File path to save:", file_path)

        backend_instance.backend.save(file_path)
        
        return {"success": True, 'msg': 'save success'}
    except Exception as error:
        print(f"Error saving file path: {error}")
        return { 'success': False, 'msg': error }

class LoadModel(BaseModel):
    filePath: str

@app.post("/load")
def load(path: LoadModel):
    global backend_instance

    path = path.filePath

    print(f"backend: loading model from source: {path}")

    try:
        backend_instance.backend = ndb.NeuralDB.from_checkpoint(
            checkpoint_path=path,
        )
    except Exception as error:
        error_msg = str(error)
        print(f"backend: {error_msg}")

    return {'success': True}

class CurrentModelInfo(BaseModel):
    author_name: Optional[str]
    model_name: Optional[str]

class SaveModelByID(BaseModel):
    workspaceID: str
    workspaceName: str
    currentModel: Optional[CurrentModelInfo]

@app.post("/save_workspace")
def save_workspace(model_data: SaveModelByID):
    workspaceID = model_data.workspaceID
    currentModel = model_data.currentModel
    workspaceName = model_data.workspaceName

    USER_WORKSPACE_CACHE = WORKING_FOLDER / "user_workspace_cache"

    # Generate a temporary workspace ID and create a temp folder
    temp_workspaceID = str(uuid4())
    temp_model_folder = USER_WORKSPACE_CACHE / temp_workspaceID
    temp_model_folder.mkdir(parents=True, exist_ok=True)

    # Define file paths for the temporary workspace
    temp_file_path = temp_model_folder / 'model.ndb'
    temp_metadata_path = temp_model_folder / 'metadata.json'
    temp_documents_folder = temp_file_path / 'documents'

    # Save the model in the temporary workspace
    backend_instance.backend.save(temp_file_path)

    # Extract document names for the temporary workspace
    # Process filesystem-based documents
    documents = []
    if temp_documents_folder.exists() and temp_documents_folder.is_dir():
        for subfolder in temp_documents_folder.iterdir():
            for file in subfolder.iterdir():
                file_info = {
                    "fileName": file.name,
                    "filePath": str(file.resolve()),
                    "uuid": str(uuid4()),
                    "isSaved": True
                }
                documents.append(file_info)

    # Process URL sources
    url_sources = backend_instance.backend.sources()
    for hash_val, source_info in url_sources.items():
        if isinstance(source_info, ndb.documents.URL):
            url_str = str(source_info.url)
            url_info = {
                "fileName": url_str,
                "filePath": url_str,
                "uuid": hash_val,
                "isSaved": True
            }
            documents.append(url_info)

    author_name = currentModel.author_name if currentModel else 'thirdai'
    model_name = currentModel.model_name if currentModel else "Default model"

    # Save the metadata in the temporary workspace
    metadata = {
        "workspaceID": workspaceID,  # Original workspace ID
        'workspaceName': workspaceName,
        "model_info": {
            "author_name": author_name,
            "model_name": model_name,
        },
        "documents": documents,
        "last_modified": datetime.utcnow().isoformat()
    }

    with open(temp_metadata_path, 'w') as meta_file:
        json.dump(metadata, meta_file)

    # Now, delete the original workspace if it exists
    original_model_folder = USER_WORKSPACE_CACHE / workspaceID
    if original_model_folder.exists():
        shutil.rmtree(original_model_folder)

    # Rename the temporary workspace to the original workspace ID
    move(str(temp_model_folder), str(original_model_folder))

    return {'success': True, 'documents': documents}

class LoadModelByID(BaseModel):
    workspaceID: str

@app.post("/load_by_id")
def load_by_id(model_data: LoadModelByID):
    global backend_instance

    workspaceID = model_data.workspaceID

    print("Received workspaceID:", workspaceID)

    USER_WORKSPACE_CACHE = WORKING_FOLDER / "user_workspace_cache"

    # Determine the path based on workspaceID
    model_folder = USER_WORKSPACE_CACHE / workspaceID
    file_path = model_folder / 'model.ndb'
    
    # Check if the path exists
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Model not found.")
    
    try:
        backend_instance.backend = ndb.NeuralDB.from_checkpoint(
            checkpoint_path=str(file_path),
        )
    except Exception as error:
        error_msg = str(error)
        print(f"backend: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)
    
    ####### Check if it's tryint to load saved Gmail workspace #######

    # Determine the path for metadata.json
    metadata_file_path = model_folder / 'metadata.json'

    # Check if the metadata.json path exists and has the expected content
    if metadata_file_path.exists():
        try:
            with open(metadata_file_path, 'r') as f:
                metadata = json.load(f)
            
            # Verify if the workspace is Gmail by checking the conditions
            documents = metadata.get('documents', [])
            if len(documents) == 1 and documents[0].get('fileName') == 'gmail_inbox_data.csv':
                backend_instance.gmail_query_switch = True
            elif len(documents) == 1 and documents[0].get('fileName') == 'outlook_inbox_data.csv':
                backend_instance.outlook_query_switch = True
            else:
                backend_instance.gmail_query_switch = False
                backend_instance.outlook_query_switch = False
        except json.JSONDecodeError as e:
            print(f"Error parsing metadata.json: {e}")
            raise HTTPException(status_code=500, detail="Error parsing metadata.json")
        except Exception as e:
            print(f"Unexpected error: {e}")
            raise HTTPException(status_code=500, detail="Unexpected error when checking workspace type")
    else:
        backend_instance.gmail_query_switch = False
        backend_instance.outlook_query_switch = False

    return {'success': True}

class DeleteModelByID(BaseModel):
    workspaceID: str

@app.post("/delete_by_id")
def delete_by_id(model_data: DeleteModelByID):
    USER_WORKSPACE_CACHE = WORKING_FOLDER / "user_workspace_cache"

    # Determine the path based on workspaceID
    model_folder = USER_WORKSPACE_CACHE / model_data.workspaceID

    # Check if the path exists
    if not model_folder.exists():
        raise HTTPException(status_code=404, detail="Model directory not found.")

    try:
        # Delete the model directory
        shutil.rmtree(model_folder)
    except Exception as error:
        error_msg = str(error)
        print(f"backend: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)
    
    return {'success': True}

class ExportModelData(BaseModel):
    filePath: str
    workspaceID: str

@app.post("/export_by_id")
def export_by_id(export_data: ExportModelData):
    USER_WORKSPACE_CACHE = WORKING_FOLDER / "user_workspace_cache"

    # Determine the path based on workspaceID
    model_folder = USER_WORKSPACE_CACHE / export_data.workspaceID

    # Check if the path exists
    if not model_folder.exists():
        raise HTTPException(status_code=404, detail="Model directory not found.")

    try:
        # Copy the model directory to the desired path
        destination_folder = Path(export_data.filePath)
        shutil.copytree(model_folder, destination_folder)
    except Exception as error:
        error_msg = str(error)
        print(f"backend: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)
    
    return {'success': True}

class ExportNewWorkspaceData(BaseModel):
    workspaceID: str
    filePath: str
    workspaceName: str
    currentModel: Optional[CurrentModelInfo]

@app.post("/export_new_workspace")
def export_new_workspace(export_data: ExportNewWorkspaceData):
    workspaceID = export_data.workspaceID
    filePath = Path(export_data.filePath)
    currentModel = export_data.currentModel
    workspaceName = export_data.workspaceName

    # Define file paths for the new workspace
    new_workspace_folder = Path(filePath)
    new_file_path = new_workspace_folder / 'model.ndb'
    new_metadata_path = new_workspace_folder / 'metadata.json'
    new_documents_folder = new_file_path / 'documents'

    # Create workspace directory
    new_workspace_folder.mkdir(parents=True, exist_ok=True)

    # Save the model in the new workspace
    backend_instance.backend.save(new_file_path)

    # Extract document names for the new workspace
    documents = []
    if new_documents_folder.exists() and new_documents_folder.is_dir():
        for subfolder in new_documents_folder.iterdir():
            for file in subfolder.iterdir():
                file_info = {
                    "fileName": file.name,
                    "filePath": str(file.resolve()),
                    "uuid": str(uuid4()),
                    "isSaved": True
                }
                documents.append(file_info)

    author_name = currentModel.author_name if export_data.currentModel else 'thirdai'
    model_name = currentModel.model_name if export_data.currentModel else "Default model"

    # Process URL sources
    url_sources = backend_instance.backend.sources()
    for hash_val, source_info in url_sources.items():
        if isinstance(source_info, ndb.documents.URL):
            url_str = str(source_info.url)
            url_info = {
                "fileName": url_str,
                "filePath": url_str,
                "uuid": hash_val,
                "isSaved": True
            }
            documents.append(url_info)

    # Save the metadata in the new workspace
    metadata = {
        "workspaceID": workspaceID,
        'workspaceName': workspaceName,
        "model_info": {
            "author_name": author_name,
            "model_name": model_name,
        },
        "documents": documents,
        "last_modified": datetime.utcnow().isoformat()
    }

    with open(new_metadata_path, 'w') as meta_file:
        json.dump(metadata, meta_file)

    return {'success': True, 'documents': documents}

class ImportModelData(BaseModel):
    directoryPath: str

@app.post("/import_workspace")
def import_workspace(import_data: ImportModelData):
    USER_WORKSPACE_CACHE = WORKING_FOLDER / "user_workspace_cache"
    chosen_directory = Path(import_data.directoryPath)

    if chosen_directory.suffix == '.ndb':
        new_workspaceID = str(uuid4())
        destination_folder = USER_WORKSPACE_CACHE / new_workspaceID
        destination_folder.mkdir(parents=True, exist_ok=True)

        metadata = {}

        model_ndb_path = destination_folder / 'model.ndb'
        shutil.copytree(chosen_directory, model_ndb_path)
        
        # Create and populate metadata.json
        metadata = {
            "workspaceID": new_workspaceID,
            "workspaceName": chosen_directory.stem,  # Use the name of the .ndb file
            "model_info": {
                "author_name": "thirdai",
                "model_name": "Default model"
            },
            "documents": [],
            "last_modified": datetime.utcnow().isoformat()
        }
        
        # Iterate inside .ndb/documents folder
        documents_folder = model_ndb_path / 'documents'
        if documents_folder.exists() and documents_folder.is_dir():
            for subfolder in documents_folder.iterdir():
                if subfolder.is_dir(): # Check if the item is a directory
                    for file in subfolder.iterdir():
                        file_info = {
                            "fileName": file.name,
                            "filePath": str(file.resolve()),
                            "uuid": str(uuid4()),
                            "isSaved": True
                        }
                        metadata["documents"].append(file_info)
        
        # Write the metadata.json file in the destination folder
        with open(destination_folder / 'metadata.json', 'w') as meta_file:
            json.dump(metadata, meta_file, indent=4)
        
        return {'success': True, 'metadata': metadata}
    elif chosen_directory.suffix == '.neural-workspace':
        metadata_path = chosen_directory / 'metadata.json'

        with open(metadata_path, 'r') as meta_file:
            metadata = json.load(meta_file)

        # Generate new workspace ID
        new_workspaceID = str(uuid4())

        # Destination folder based on new workspace ID
        destination_folder = USER_WORKSPACE_CACHE / new_workspaceID

        try:
            shutil.copytree(chosen_directory, destination_folder)
        except Exception as error:
            raise HTTPException(status_code=500, detail=str(error))

        # Update metadata with the new workspace ID
        metadata['workspaceID'] = new_workspaceID
        new_metadata_path = destination_folder / 'metadata.json'

        with open(new_metadata_path, 'w') as meta_file:
            json.dump(metadata, meta_file)

        return {'success': True, 'metadata': metadata}
    else:
        raise HTTPException(status_code=400, detail="Unsupported workspace type.")

class UpdateWorkspaceNameRequest(BaseModel):
    workspaceID: str
    newWorkspaceName: str

@app.post("/update_workspace_name")
def update_workspace_name(request: UpdateWorkspaceNameRequest):
    workspace_id = request.workspaceID
    new_workspace_name = request.newWorkspaceName

    USER_WORKSPACE_CACHE = WORKING_FOLDER / "user_workspace_cache"

    workspace_folder = USER_WORKSPACE_CACHE / workspace_id
    metadata_path = workspace_folder / 'metadata.json'

    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Metadata file not found.")

    with open(metadata_path, 'r') as file:
        metadata = json.load(file)

    metadata['workspaceName'] = new_workspace_name

    with open(metadata_path, 'w') as file:
        json.dump(metadata, file, indent=4)

    return {"success": True}


@app.post("/fetch_model_cards")
def fetch_model_cards():
    global backend_instance

    def clean_bazaar_entry(bazaar_entry):
        # TODO: cache function is not working (_model_dir_in_cache)
        # print(self.bazaar._model_dir_in_cache(bazaar_entry.identifier))
        # print(self.bazaar._cached_model_dir_path(bazaar_entry.identifier))
        # print(bazaar_entry.is_indexed)
        return {
            "domain": bazaar_entry.domain,
            "modelName": bazaar_entry.model_name,
            "authorUsername": bazaar_entry.author_username,
            "modelDesc": bazaar_entry.description,
            "task": bazaar_entry.trained_on,
            "hasIndex": bazaar_entry.is_indexed,
            "publishDate": bazaar_entry.publish_date,
            "dataset": bazaar_entry.trained_on,
            # modelSize and modelSizeInMemory are expected to be in MB, but they are in B
            "modelSize": bazaar_entry.size // (1024 * 1024),
            "modelSizeInMemory": bazaar_entry.size_in_memory // (1024 * 1024),
            "isCached": True
            if backend_instance.bazaar._model_dir_in_cache(
                bazaar_entry.identifier, bazaar_entry, only_check_dir_exists=True
            )
            else False,
        }
    
    model_cards = [
        clean_bazaar_entry(bazaar_entry)
        for bazaar_entry in backend_instance.bazaar.fetch()
    ]

    for card in model_cards:
        card["domain"] = "Public"

    return model_cards

@app.websocket("/fetch_base_model")
async def fetch_base_model(websocket: WebSocket):
    await websocket.accept()

    global backend_instance

    async for message in websocket.iter_text():

        data = json.loads(message)
        
        domain = data['domain']
        author_username = data['author_username']
        model_name = data['model_name']

        async def async_on_progress(fraction):
            progress = int(100 * fraction)
            message = "Downloading model in progress"
            await websocket.send_json({"progress": progress, "message": message})

        def on_progress(fraction):
            loop.call_soon_threadsafe(asyncio.create_task, async_on_progress(fraction))

        try:
            loop = asyncio.get_running_loop()
            checkpoint_dir = await loop.run_in_executor(None, lambda: backend_instance.bazaar.get_model_dir(
                model_name, 
                author_username, 
                on_progress=on_progress))
            
            # TODO: update isCached status of this model card in caches
            await websocket.send_json({"progress": 100, "message": f'Model downloaded at {checkpoint_dir}'})
        except Exception as e:
            await websocket.send_json({"error": True, "message": str(e)})

class RemoveModelInfo(BaseModel):
    author_username: str
    model_name: str

@app.post("/remove_model")
def remove_model(info: RemoveModelInfo):
    global backend_instance
    
    # Construct the identifier using the provided author_username and model_name
    identifier = f"{info.author_username}/{info.model_name}"
    
    # Construct the directory path that needs to be removed
    directory_to_remove = backend_instance.bazaar._cached_checkpoint_dir(identifier)

    try:
        # Use shutil.rmtree to remove the directory
        shutil.rmtree(directory_to_remove)
        return {"success": True, "msg": f"Removed model {identifier}"}
    except Exception as e:
        # If an error occurs, return an error message
        raise HTTPException(status_code=500, detail=str(e))

class UseInfoModel(BaseModel):
    domain: str
    author_username: str
    model_name: str

@app.post("/use_model")
def use_model(useInfo: UseInfoModel):
    global backend_instance

    domain = useInfo.domain
    author_username = useInfo.author_username
    model_name = useInfo.model_name

    backend_instance.backend = ndb.NeuralDB.from_checkpoint(
        checkpoint_path=backend_instance.bazaar._cached_model_dir_path(
            f"{author_username}/{model_name}"
        )
    )
    backend_instance.backend.build_inverted_index()

    return {"success": True, 
            "msg": f'Backend use model {domain}/{author_username}/{model_name}'}

@app.post("/fetch_meta_cache_model")
def fetch_meta_cache_model():
    return backend_instance.bazaar.fetch_meta_cache_model()

@app.get("/get_cached_openai_key")
def get_cached_openai_key():
    key_file_path = WORKING_FOLDER / 'user_openai_key.txt'
    if key_file_path.exists():
        with open(key_file_path, 'r') as key_file:
            return {"openai_key": key_file.read()}
    else:
        return {"openai_key": ""}

class SettingInput(BaseModel):
    model_preference: str
    open_ai_api_key: str

@app.post("/setting")
def setting(input_data: SettingInput):
    global backend_instance
    backend_instance.open_ai_api_key = input_data.open_ai_api_key
    backend_instance.preferred_summary_model = input_data.model_preference
    
    # Check if the preferred summary model is 'OpenAI'
    if input_data.model_preference == "OpenAI":
        # Ensure the cache directory exists
        WORKING_FOLDER.mkdir(parents=True, exist_ok=True)

        # Write the OpenAI API key to the file
        with open(WORKING_FOLDER / 'user_openai_key.txt', 'w') as key_file:
            key_file.write(input_data.open_ai_api_key)

    return {"success": True, 
            "msg": f'Settings updated: open_ai_api_key: {backend_instance.open_ai_api_key} | model_preference: {backend_instance.preferred_summary_model}'}

@app.post("/summarize")
def summarize():
    def reset_summarizers(error_msg):
        print(error_msg)
        backend_instance.openai_summarizer = None
        backend_instance.thirdai_summarizer = None

    summary_query, summary_prompt = parse_prompt(backend_instance.current_query)

    model_preference = backend_instance.preferred_summary_model

    if model_preference == 'ThirdAI':
        if not backend_instance.thirdai_summarizer:
            backend_instance.thirdai_summarizer = UDTEmbedding(
                get_model=lambda: backend_instance.backend._savable_state.model.get_model(),
                get_query_col=lambda: backend_instance.backend._savable_state.model.get_query_col(),
            )
        model = backend_instance.thirdai_summarizer
        results = model.answer(
            prompt=summary_prompt,
            question=summary_query,
            context="\n".join([ref.text for ref in backend_instance.current_results[:10]]),
            on_error=reset_summarizers,
        )

        return results

@app.websocket("/summarize/ws/")
async def websocket_summarize(websocket: WebSocket):
    def reset_summarizers(error_msg):
        print(error_msg)
        backend_instance.openai_summarizer = None
        backend_instance.thirdai_summarizer = None

    await websocket.accept()
    
    model_preference, open_ai_api_key = backend_instance.preferred_summary_model, backend_instance.open_ai_api_key
    summary_query, summary_prompt = parse_prompt(backend_instance.current_query)

    if model_preference == 'OpenAI':
        if not backend_instance.openai_summarizer:
            backend_instance.openai_summarizer = OpenAI(open_ai_api_key)
        
        model = backend_instance.openai_summarizer
        await model.stream_answer(
            prompt=summary_prompt,
            question=summary_query,
            context="\n".join([ref.text for ref in backend_instance.current_results[:10]]),
            websocket=websocket,
            on_error=reset_summarizers,
        )

        await websocket.close()

@app.websocket("/gmail_summarize/ws/")
async def gmail_summarize(websocket: WebSocket):
    open_ai_api_key = backend_instance.open_ai_api_key
    if not open_ai_api_key:
        # No need to accept the connection. Send an error message and close the socket.
        await websocket.accept()
        await websocket.send_text("Error: OpenAI API key is not set.")
        await websocket.close()
        return


    def reset_summarizers(error_msg):
        print(error_msg)
        backend_instance.openai_summarizer = None
        backend_instance.thirdai_summarizer = None

    await websocket.accept()
    
    email_content = await websocket.receive_text()
    
    model_preference, open_ai_api_key = backend_instance.preferred_summary_model, backend_instance.open_ai_api_key

    if model_preference == 'OpenAI':
        if not backend_instance.openai_summarizer:
            backend_instance.openai_summarizer = OpenAI(open_ai_api_key)
        
        model = backend_instance.openai_summarizer
        await model.stream_answer(
            # prompt=summary_prompt,
            question='what is this email about?',
            context=email_content,
            websocket=websocket,
            on_error=reset_summarizers,
            model="gpt-3.5-turbo-16k",
        )

        await websocket.close()

@app.websocket("/gmail_reply/ws/")
async def gmail_reply(websocket: WebSocket):
    open_ai_api_key = backend_instance.open_ai_api_key
    if not open_ai_api_key:
        # No need to accept the connection. Send an error message and close the socket.
        await websocket.accept()
        await websocket.send_text("Error: OpenAI API key is not set.")
        await websocket.close()
        return

    def reset_summarizers(error_msg):
        print(error_msg)
        backend_instance.openai_summarizer = None
        backend_instance.thirdai_summarizer = None

    await websocket.accept()
    
    data = await websocket.receive_text()
    parsed_data = json.loads(data)
    email_content = parsed_data["emailContent"]
    userIntent = parsed_data["userIntent"]
    
    model_preference, open_ai_api_key = backend_instance.preferred_summary_model, backend_instance.open_ai_api_key

    if model_preference == 'OpenAI':
        if not backend_instance.openai_summarizer:
            backend_instance.openai_summarizer = OpenAI(open_ai_api_key)
        
        model = backend_instance.openai_summarizer
        await model.stream_answer(
            prompt = (
                "Write a reply that is about 100 words "
                "Answer in a friendly tone. "
            ),
            question=f'I am writing a reply to the email. In this case I want to say: {userIntent}. Help me write what I want to say fully.',
            context=email_content,
            websocket=websocket,
            on_error=reset_summarizers,
            model="gpt-3.5-turbo-16k",
        )

        await websocket.close()

@app.post("/gmail_inbox_delete_credential")
def gmail_inbox_delete_credential():
    USER_GMAIL_CACHE = WORKING_FOLDER / "user_gmail_cache"
    credential_files = list(USER_GMAIL_CACHE.glob("*_token.pkl"))

    # If there's a file, delete it
    if credential_files and len(credential_files) > 0:
        try:
            credential_files[0].unlink()  # deletes the first file
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Credential file not found.")
    else:
        raise HTTPException(status_code=404, detail="Credential file not found.")

    return {"success": True, "message": "Credentials deleted successfully."}

@app.post('/gmail_delete_login_credential')
def gmail_delete_login_credential():
    try:
        USER_GMAIL_LOGIN_CACHE = WORKING_FOLDER / "user_gmail_login_cache"

        # Check if credentials dir exists and delete it
        if USER_GMAIL_LOGIN_CACHE.exists():
            shutil.rmtree(USER_GMAIL_LOGIN_CACHE)

        IDENTITY_FILE = WORKING_FOLDER / 'user_identity.json'
        with open(IDENTITY_FILE, 'r') as file:
            identity_data = json.load(file)
        identity_data['gmail_id'] = None
        with open(IDENTITY_FILE, 'w') as file:
            json.dump(identity_data, file)

        return {"success": True, "message": "Gmail login credential deleted."}
    except Exception as e:
        return {"success": False, "message": f"Error during logout: {str(e)}"}

@app.post('/gmail_auto_login')
def gmail_auto_login():
    USER_GMAIL_LOGIN_CACHE = WORKING_FOLDER / "user_gmail_login_cache"
    USER_GMAIL_LOGIN_CACHE.mkdir(parents=True, exist_ok=True)

    creds = None
    creds_file_path = USER_GMAIL_LOGIN_CACHE / "credentials.pkl"
    
    # Load credentials from cache if they exist
    if creds_file_path.exists():
        with open(creds_file_path, 'rb') as token:
            creds = pickle.load(token)

    # If no valid credentials available
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            return {
                "success": False, 
                'msg': 'No valid credentials available.'
            }

    # Use the credentials to authenticate and fetch user details
    session = requests.Session()
    session.headers.update({
        'Authorization': f'Bearer {creds.token}',
        'Content-Type': 'application/json',
    })

    response = session.get('https://www.googleapis.com/oauth2/v1/userinfo')
    if response.status_code == 200:
        user_info = response.json()
        return {
            "success": True, 
            'msg': 'Gmail auth successful', 
            'email': user_info['email'], 
            'name': user_info['name']
        }
    else:
        return {
            "success": False, 
            'msg': f"Failed to fetch user's email. Error: {response.text}"
        }

@app.post('/gmail_login')
def gmail_login():
    global backend_instance

    USER_GMAIL_LOGIN_CACHE = WORKING_FOLDER / "user_gmail_login_cache"
    USER_GMAIL_LOGIN_CACHE.mkdir(parents=True, exist_ok=True)

    creds = None

    # Check for cached credentials
    creds_file_path = USER_GMAIL_LOGIN_CACHE / "credentials.pkl"
    if creds_file_path.exists():
        with open(creds_file_path, 'rb') as token:
            creds = pickle.load(token)

    # If no valid credentials available, prompt the user to log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if getattr(sys, 'frozen', False):
                application_path = sys._MEIPASS
            else:
                application_path = os.path.dirname(os.path.abspath(__file__))

            client_secrets_path = os.path.join(application_path, 'client_secret_user_account.json')
            
            flow = InstalledAppFlow.from_client_secrets_file(
                client_secrets_path, 
                scopes=['https://www.googleapis.com/auth/userinfo.email', 'openid', 'https://www.googleapis.com/auth/userinfo.profile'],
            )
            
            creds = flow.run_local_server(port=0)

            # Save the credentials for the next run
            with open(creds_file_path, 'wb') as token:
                pickle.dump(creds, token)

    # Create a session for the authenticated request
    session = requests.Session()
    session.headers.update({
        'Authorization': f'Bearer {creds.token}',
        'Content-Type': 'application/json',
    })

    # Make a request to get the user's information
    response = session.get('https://www.googleapis.com/oauth2/v1/userinfo')
    if response.status_code == 200:
        user_info = response.json()

        # Write gmail id into user identity system
        IDENTITY_FILE = WORKING_FOLDER / 'user_identity.json'
        email_id = hashlib.sha256(user_info['email'].encode()).hexdigest()

        if IDENTITY_FILE.exists():
            with open(IDENTITY_FILE, 'r', encoding='utf-8') as file:
                identity = json.load(file)

        # Update the identity with the hashed email
        identity['gmail_id'] = email_id

        # Save the updated identity
        with open(IDENTITY_FILE, 'w', encoding='utf-8') as file:
            json.dump(identity, file)

        return {
            "success": True, 
            'msg': 'Gmail auth successful', 
            'email': user_info['email'], 
            'name': user_info['name']
        }
    else:
        return {"success": False, 'msg': f"Failed to fetch user's email. Error: {response.text}"}

@app.post('/gmail_auth')
def gmail_auth():
    global backend_instance

    # Define the path to the "user_gmail_cache" folder
    USER_GMAIL_CACHE = WORKING_FOLDER / "user_gmail_cache"
    # Ensure the folder exists
    USER_GMAIL_CACHE.mkdir(parents=True, exist_ok=True)

    def save_credentials_to_file(user_id, credentials):
        file_path = USER_GMAIL_CACHE / f"{user_id}_token.pkl"
        with open(file_path, 'wb') as token_file:
            pickle.dump(credentials, token_file)

    def get_credentials_from_file(user_id):
        file_path = USER_GMAIL_CACHE / f"{user_id}_token.pkl"
        try:
            with open(file_path, 'rb') as token_file:
                return pickle.load(token_file)
        except FileNotFoundError:
            return None

    user_id = 'me'

    # Check if we have previously stored credentials for this user
    stored_creds = get_credentials_from_file(user_id)
    if stored_creds and stored_creds.valid:
        credentials = stored_creds
    else:
        if stored_creds and stored_creds.expired and stored_creds.refresh_token:
            try:
                stored_creds.refresh(Request())
                credentials = stored_creds
                save_credentials_to_file(user_id, credentials)  # save the refreshed credentials
            except Exception as e:
                # Handle error, perhaps reinitiate the auth flow
                return {"success": False, "msg": f"Failed to refresh credentials: {str(e)}"}
        else:
            if getattr(sys, 'frozen', False):
                application_path = sys._MEIPASS
            else:
                application_path = os.path.dirname(os.path.abspath(__file__))

            client_secrets_path = os.path.join(application_path, 'client_secrets.json')

            flow = InstalledAppFlow.from_client_secrets_file(
                client_secrets_path,
                scopes=['https://www.googleapis.com/auth/gmail.readonly'],
            )

            # Open browser for the user to authenticate
            try:
                credentials = flow.run_local_server(port=0)
                # Save the credentials for future use
                save_credentials_to_file(user_id, credentials)
            except Exception as error:
                return {"success": False, "msg": str(error)}

    # Build the Gmail API service and save it for the user
    service = build('gmail', 'v1', credentials=credentials)
    backend_instance.gmail_auth_services[user_id] = service

    return {"success": True, 'msg': 'Gmail auth successful'}

    # # Get user's detailed information using the OAuth2 userinfo endpoint
    # try:
    #     session = requests.Session()
    #     session.headers.update({
    #         'Authorization': f'Bearer {credentials.token}',
    #         'Content-Type': 'application/json',
    #     })

    #     response = session.get('https://www.googleapis.com/oauth2/v1/userinfo')

    #     if response.status_code == 200:
    #         user_info = response.json()
    #         return {
    #             "success": True, 
    #             'msg': 'Gmail auth successful', 
    #             'email': user_info['email'], 
    #             'name': user_info['name']
    #         }
    #     else:
    #         return {
    #             "success": False, 
    #             'msg': f"Failed to fetch user's email. Error: {response.text}"
    #         }
    # except Exception as e:
    #     return {"success": False, "msg": f"Failed to get user profile: {str(e)}"}

@app.post("/gmail_total_emails")
def gmail_total_emails(user_id: str = 'me'):
    service = backend_instance.gmail_auth_services.get(user_id)
    if not service:
        raise HTTPException(status_code=401, detail="User not authenticated")

    profile = service.users().getProfile(userId=user_id).execute()
    total_emails = profile.get('messagesTotal')
    return {"total_emails": total_emails}

@app.websocket("/gmail_download_train")
async def  gmail_download_train(websocket: WebSocket):
    global backend_instance

    ##############################################  Download  ##########################################

    # Function to send progress updates through the WebSocket connection
    async def send_progress_update(progress, message):
        await websocket.send_json({"progress": progress, "message": message})

    def extract_text_from_mime(mime_msg):
        text_content = None
        
        # Try to find 'text/plain' part first
        for part in mime_msg.walk():
            if part.get_content_type() == 'text/plain':
                charset = part.get_content_charset() or 'utf-8'
                text_content = part.get_payload(decode=True).decode(charset, 'ignore')
                break

        # If 'text/plain' is not found, try 'text/html'
        if not text_content:
            for part in mime_msg.walk():
                if part.get_content_type() == 'text/html':
                    charset = part.get_content_charset() or 'utf-8'
                    html_content = part.get_payload(decode=True).decode(charset, 'ignore')
                    soup = BeautifulSoup(html_content, 'html.parser')
                    text_content = soup.get_text(separator=' ', strip=True)
                    break

        return text_content
    
    @retry(stop_max_attempt_number=3, wait_fixed=5000)
    def fetch_gmail_message(service, msg_id):
        return service.users().messages().get(userId='me', id=msg_id, format='raw').execute()

    def decode_mime_header(header):
        decoded_headers = decode_header(header)
        header_parts = []
        for text, charset in decoded_headers:
            if isinstance(text, bytes):
                charset = charset or 'ascii'  # Default charset to ascii if none is provided
                header_parts.append(text.decode(charset, errors='ignore'))
            else:
                header_parts.append(text)
        return "".join(header_parts)

    await websocket.accept()

    async for message in websocket.iter_text():
        data = json.loads(message)
        
        user_id = data.get('user_id', 'me')
        num_emails = data.get("num_emails", 1000)

        service = backend_instance.gmail_auth_services.get(user_id)

        # Get 'num_emails' messages
        all_messages = []
        page_token = None

        while True:
            results = service.users().messages().list(userId='me', pageToken=page_token).execute()
            messages = results.get('messages', [])
            if not messages:
                break
            all_messages.extend(messages)

            # Check if we have num_emails or more messages and break out of the loop
            if len(all_messages) >= num_emails:
                break

            page_token = results.get('nextPageToken')
            if not page_token:
                break
        
        # Trim the list to have exactly num_emails messages
        all_messages = all_messages[:num_emails]
        print(all_messages)

        # Specify the temporary folder using the WORKING_FOLDER path
        USER_GMAIL_INBOX_TEMP_CACHE = WORKING_FOLDER / "user_gmail_inbox_temp_cache"

        # Check if USER_GMAIL_INBOX_TEMP_CACHE exists, if so, delete it
        if USER_GMAIL_INBOX_TEMP_CACHE.exists():
            shutil.rmtree(USER_GMAIL_INBOX_TEMP_CACHE)

        USER_GMAIL_INBOX_TEMP_CACHE.mkdir(parents=True, exist_ok=True)

        # Create a CSV file within this temporary folder
        temp_file_location = USER_GMAIL_INBOX_TEMP_CACHE / "gmail_inbox_data.csv"

        # Open a CSV file in write mode
        with open(temp_file_location, mode='w', encoding='utf-8') as csvfile:
            temp_file_location = csvfile.name

            writer = csv.writer(csvfile)

            # Write a header row to the CSV file
            writer.writerow(['Message ID', 'Email Content', 'Subject'])

            # Iterate over each message ID and fetch the message content
            for idx, message_info in enumerate(all_messages):
                msg_id = message_info['id']

                try:
                    message = fetch_gmail_message(service, msg_id)
        
                    # Extract the raw email data from the message and decode it
                    msg_raw = base64.urlsafe_b64decode(message['raw'].encode('ASCII'))

                    # Parse the raw email to get a MIME message object
                    mime_msg = message_from_bytes(msg_raw)

                    subject = decode_mime_header(mime_msg.get("Subject", ""))

                    # Get the plain text content from the MIME message
                    text_content = extract_text_from_mime(mime_msg)

                    if text_content:
                        if '<html' in text_content.lower():
                            # Parse the content using BeautifulSoup
                            soup = BeautifulSoup(text_content, 'html.parser')
                            # Extract the plain text
                            text_content = soup.get_text(separator=' ', strip=True)

                        # Compact the content to remove multiple newlines
                        text_content = re.sub(r'\n+', '\n', text_content)
                        writer.writerow([msg_id, text_content, subject])

                    await send_progress_update(round( (idx / len(all_messages)) * 100, 2), f"Processed {idx} of {len(all_messages)} messages")
                
                except Exception as e:
                    print(f"Failed to fetch message with ID {msg_id}. Error: {e}")
                    continue  # Skip this message and move to the next

            await send_progress_update(100, f"Finished processing {len(all_messages)} messages saved at {temp_file_location}")

        ##############################################  Train  ##########################################

        # Reset neuraldb to make sure previously trained files are not included.
        backend_instance.reset_neural_db()

        documents = [ndb.CSV(temp_file_location, strong_columns = ['Subject'], weak_columns=['Email Content'], reference_columns = ['Message ID', 'Email Content'])]

        async def async_on_progress(fraction):
            progress = int(100 * fraction)
            message = "Indexing in progress"
            await websocket.send_json({"progress": progress, "message": message, "complete": False})

        def on_progress(fraction):
            loop.call_soon_threadsafe(asyncio.create_task, async_on_progress(fraction))

        def on_error(error_msg):
            loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"error": True, "message": error_msg}))

        def on_success():
            # Turn on Gmail query switch
            backend_instance.gmail_query_switch = True
            loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"progress": 100, "message": "Indexing completed", "complete": True}))

        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: backend_instance.backend.insert(
                sources=documents,
                on_progress=on_progress,
                on_error=on_error,
                on_success=on_success,
            ))
        except Exception as e:
            await websocket.send_json({"error": True, "message": str(e)})

@app.websocket("/gmail_train_from_csv")
async def gmail_train_from_csv(websocket: WebSocket):
    global backend_instance

    await websocket.accept()

    async for message in websocket.iter_text():
        data = json.loads(message)
        
        csv_file_path = data.get('csv_file_path', 'me')

        # TODO optimize: reading, editing, and writing is time consuming for large CSV gmail file.
            # One quick optimization is to allow neuraldb to take into df as variable

        # Load CSV into memory and rename columns
        df = pd.read_csv(csv_file_path)
        df.rename(columns={'ID': 'Message ID', 'Snippet': 'Email Content'}, inplace=True)

        # Specify the temporary folder using the WORKING_FOLDER path
        USER_GMAIL_INBOX_TEMP_CACHE = WORKING_FOLDER / "user_gmail_inbox_temp_cache"

        # Check if USER_GMAIL_INBOX_TEMP_CACHE exists, if so, delete it
        if USER_GMAIL_INBOX_TEMP_CACHE.exists():
            shutil.rmtree(USER_GMAIL_INBOX_TEMP_CACHE)

        USER_GMAIL_INBOX_TEMP_CACHE.mkdir(parents=True, exist_ok=True)

        # Create a CSV file within this temporary folder
        temp_file_location = USER_GMAIL_INBOX_TEMP_CACHE / "gmail_inbox_data.csv"
        df.to_csv(temp_file_location, index=False)

        # Reset neuraldb to make sure previously trained files are not included.
        backend_instance.reset_neural_db()

        documents = [ndb.CSV(temp_file_location, strong_columns = ['Subject'], weak_columns=['Email Content'], reference_columns = ['Message ID', 'Email Content'])]

        async def async_on_progress(fraction):
            progress = int(100 * fraction)
            message = "Indexing in progress"
            await websocket.send_json({"progress": progress, "message": message, "complete": False})

        def on_progress(fraction):
            loop.call_soon_threadsafe(asyncio.create_task, async_on_progress(fraction))

        def on_error(error_msg):
            loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"error": True, "message": error_msg}))

        def on_success():
            # Turn on Gmail query switch
            backend_instance.gmail_query_switch = True
            loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"progress": 100, "message": "Indexing completed", "complete": True}))

        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: backend_instance.backend.insert(
                sources=documents,
                on_progress=on_progress,
                on_error=on_error,
                on_success=on_success,
            ))
        except Exception as e:
            await websocket.send_json({"error": True, "message": str(e)})

def safe_create_url_wrapper(args):
    return safe_create_url(*args)

def safe_create_url(url, response):
    try:
        return ndb.URL(url=url, url_response=response)
    except Exception as e:
        return None

@app.websocket("/url_train")
async def url_train(websocket: WebSocket):
    def process_url(url):
        try:
            response = requests.get(url)
            return response
        except Exception as e:
            return None

    await websocket.accept()

    global backend_instance

    # If previously trained on Gmail, reset neuraldb
    if backend_instance.gmail_query_switch:
        backend_instance.reset_neural_db()

    if backend_instance.outlook_query_switch:
        backend_instance.reset_neural_db()

    async def async_on_progress(fraction):
        progress = int(100 * fraction)
        message = "Indexing in progress"
        await websocket.send_json({"progress": progress, "message": message, "complete": False})

    def on_progress(fraction):
        loop.call_soon_threadsafe(asyncio.create_task, async_on_progress(fraction))

    def on_error(error_msg):
        loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"error": True, "message": error_msg}))

    def on_success():
        # Turn off Gmail query switch
        backend_instance.gmail_query_switch = False
        backend_instance.outlook_query_switch = False

        loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"progress": 100, "message": "Indexing completed", "complete": True}))

    async for message in websocket.iter_text():
        data = json.loads(message)       
        
        urls = data.get('urls')
        urls = list(set(urls))
        urls = [url for url in urls if not url.startswith('http://localhost') and url]

        with ThreadPoolExecutor(max_workers=100) as executor:
            results = list(executor.map(process_url, urls))

        await websocket.send_json({"progress": 33, "message": 'ThreadPoolExecutor is completed', "complete": False})

        url_response_pairs = list(zip(urls, results))
        filtered_pairs = [(url, response) for url, response in url_response_pairs if response is not None and url]

        # Take only the first 200 elements from filtered_pairs
        filtered_pairs = filtered_pairs[:200]

        with multiprocessing.Pool(processes=multiprocessing.cpu_count()) as pool:
            documents = pool.map(safe_create_url_wrapper, filtered_pairs)

        documents = [doc for doc in documents if doc is not None]

        await websocket.send_json({"progress": 66, "message": 'creating documents is completed', "complete": False})

        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: backend_instance.backend.insert(
                sources=documents,
                on_progress=on_progress,
                on_error=on_error,
                on_success=on_success,
            ))
        except Exception as e:
            await websocket.send_json({"error": True, "message": str(e)})

@app.post("/reset_neural_db")
def reset_neural_db():
    global backend_instance

    backend_instance.reset_neural_db()

    return {"success": True, 'msg': 'Neural DB reset successful'}

OUTLOOK_CLIENT_ID = "a0e83608-a426-46ba-be71-040486d5c230"
OUTLOOK_TENANT_ID = "f8cdef31-a31e-4b4a-93e4-5f571e91255a"
OUTLOOK_CLIENT_SECRET = "xFT8Q~C1t-nUTGvf4Brmh5vr5tvwt5cdAgrhecL4"
OUTLOOK_SCOPES = ["https://graph.microsoft.com/Mail.Read"]

@app.get("/outlook_auth")
def outlook_auth():
    # Helper function to generate the Microsoft OAuth URL
    def get_microsoft_auth_url():
        params = {
            "client_id": OUTLOOK_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": OUTLOOK_REDIRECT_URI,
            "response_mode": "query",
            "scope": " ".join(OUTLOOK_SCOPES)
        }
        return f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?{urlencode(params)}"
    
    auth_url = get_microsoft_auth_url()
    webbrowser.open(auth_url)  # Try to open the browser
    return {"message": "Check your browser to login", "url": auth_url}

# Global variable to store the outlook authentication status for Electron frontend Polling
auth_status = {"is_authenticated": False, 'total_emails': None}

@app.get("/get_outlook_auth_status")
def get_outlook_auth_status():
    global auth_status

    current_status = deepcopy(auth_status)

    auth_status = {"is_authenticated": False, 'total_emails': None}

    return current_status

@app.get("/outlook_callback")
def outlook_callback(code: str = None):
    global auth_status

    def exchange_code_for_token(code):
        token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "client_id": OUTLOOK_CLIENT_ID,
            "scope": " ".join(OUTLOOK_SCOPES),
            "code": code,
            "redirect_uri": OUTLOOK_REDIRECT_URI,
            "grant_type": "authorization_code",
        }
        response = requests.post(token_url, headers=headers, data=data)
        return response.json()

    def get_email_count(access_token):
        graph_url = "https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$count=true"
        headers = {"Authorization": f"Bearer {access_token}", "ConsistencyLevel": "eventual"}
        response = requests.get(graph_url, headers=headers)
        return response.json().get('@odata.count', 0)

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    
    # Exchange code for token
    token_response = exchange_code_for_token(code)
    access_token = token_response.get("access_token")

    if not access_token:
        raise HTTPException(status_code=500, detail="Failed to obtain access token")

    backend_instance.outlook_access_token = access_token

    total_emails = get_email_count(access_token)

    auth_status["is_authenticated"] = True
    auth_status["total_emails"] = total_emails

    return {'message': 'The authentication has succeeded. Please go back to PocketLLM.'}

@app.websocket("/outlook_download_train")
async def outlook_download_train(websocket: WebSocket):

    ##############################################  Download  ##########################################

    async def get_user_emails(access_token, max_emails, websocket):
        total_emails_url = "https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$count=true"
        headers = {"Authorization": f"Bearer {access_token}"}
        total_response = requests.get(total_emails_url, headers=headers)
        total_count = total_response.json().get('@odata.count', 0)

        emails = []
        processed = 0
        skip = 0
        while processed < total_count and processed < max_emails:
            batch_url = f"https://graph.microsoft.com/v1.0/me/messages?$top={min(max_emails, 50)}&$skip={skip}"
            batch_response = requests.get(batch_url, headers=headers)
            batch_emails = batch_response.json().get('value', [])
            emails.extend(batch_emails)
            processed += len(batch_emails)
            skip += len(batch_emails)

            # Send progress update
            progress = (processed / min(total_count, max_emails)) * 100
            await websocket.send_json({"progress": progress, "message": f"Downloaded {processed}/{min(total_count, max_emails)} emails", "complete": False})

            if len(batch_emails) == 0:
                break  # No more emails to fetch

        return emails

    def extract_email_data(emails):
        # Helper function to convert HTML to plain text
        def html_to_text(html):
            soup = BeautifulSoup(html, "html.parser")
            return soup.get_text()

        emails_data = []
        for email in emails:
            email_id = email.get('conversationId')
            subject = email.get('subject')
            html_content = email.get('body', {}).get('content')
            plain_text_content = html_to_text(html_content)
            emails_data.append((email_id, subject, plain_text_content))
        return emails_data


    await websocket.accept()

    async for message in websocket.iter_text():
        data = json.loads(message)

        # Number of emails to download
        num_emails = data.get("num_emails", 10)

        # Fetch emails using the access token
        emails = await get_user_emails(backend_instance.outlook_access_token, num_emails, websocket)
        emails_data = extract_email_data(emails)
        
        # Specify and prepare the folder for CSV file
        USER_OUTLOOK_INBOX_TEMP_CACHE = WORKING_FOLDER / "user_outlook_inbox_temp_cache"
        if USER_OUTLOOK_INBOX_TEMP_CACHE.exists():
            shutil.rmtree(USER_OUTLOOK_INBOX_TEMP_CACHE)
        USER_OUTLOOK_INBOX_TEMP_CACHE.mkdir(parents=True, exist_ok=True)

        # CSV file location
        temp_file_location = USER_OUTLOOK_INBOX_TEMP_CACHE / "outlook_inbox_data.csv"

        # Write to CSV
        with open(temp_file_location, mode='w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['Message ID', 'Subject', 'Email Content'])

            for email_id, subject, html_content in emails_data:
                writer.writerow([email_id, subject, html_content])

            await websocket.send_json({"progress": 100, "message": f"Emails saved to CSV at {str(temp_file_location)}",  "complete": True})

        ##############################################  Train  ##########################################

        # Reset neuraldb to make sure previously trained files are not included.
        backend_instance.reset_neural_db()

        documents = [ndb.CSV(temp_file_location, strong_columns = ['Subject'], weak_columns=['Email Content'], reference_columns = ['Message ID', 'Email Content'])]

        async def async_on_progress(fraction):
            progress = int(100 * fraction)
            message = "Indexing in progress"
            await websocket.send_json({"progress": progress, "message": message, "complete": False})

        def on_progress(fraction):
            loop.call_soon_threadsafe(asyncio.create_task, async_on_progress(fraction))

        def on_error(error_msg):
            loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"error": True, "message": error_msg}))

        def on_success():
            # Turn on Outlook query switch
            backend_instance.outlook_query_switch = True
            loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"progress": 100, "message": "Indexing completed", "complete": True}))

        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: backend_instance.backend.insert(
                sources=documents,
                on_progress=on_progress,
                on_error=on_error,
                on_success=on_success,
            ))
        except Exception as e:
            await websocket.send_json({"error": True, "message": str(e)})

if __name__ == "__main__":
    multiprocessing.freeze_support()

    backend_instance = Backend()

    FASTAPI_LOCALHOST_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    WORKING_FOLDER = Path(sys.argv[2]) if len(sys.argv) > 2 else WORKING_FOLDER

    OUTLOOK_REDIRECT_URI = f"http://localhost:{FASTAPI_LOCALHOST_PORT}/outlook_callback"

    print(f'backend: FASTAPI_LOCALHOST_PORT = {FASTAPI_LOCALHOST_PORT}')
    print(f'backend: WORKING_FOLDER = {WORKING_FOLDER}')

    # Configure WebSocket ping interval and timeout
    websocket_ping_interval = 300  # Ping every 5 minutes
    websocket_ping_timeout = 1200   # Timeout after 20 minutes of no response

    uvicorn.run(app, host="0.0.0.0", port=FASTAPI_LOCALHOST_PORT,
                ws_ping_interval=websocket_ping_interval,
                ws_ping_timeout=websocket_ping_timeout)