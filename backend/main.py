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
from langchain.text_splitter import RecursiveCharacterTextSplitter
import pickle
import base64
from bs4 import BeautifulSoup
import re
import csv
from email import message_from_bytes
from email.utils import parsedate_to_datetime
from retrying import retry
from email.header import decode_header
import requests
import shutil
from datetime import datetime, timezone
import io
from uuid import uuid4
from highlight import highlight_ref as hl
from shutil import move
from concurrent.futures import ThreadPoolExecutor
import multiprocessing
from thirdai import licensing
import trafilatura
from chat import open_ai_chat



if getattr(sys, 'frozen', False):
    APPLICATION_PATH = sys._MEIPASS
else:
    APPLICATION_PATH = os.path.dirname(os.path.abspath(__file__))
THIRDAI_LICENSE_PATH = os.path.join(APPLICATION_PATH, 'license_may_11_2024.serialized')
licensing.set_path(THIRDAI_LICENSE_PATH)


WORKING_FOLDER = Path(os.path.dirname(__file__)) / "data"
BAZAAR_CACHE = WORKING_FOLDER / "bazaar_cache"
BAZAAR_URL = "https://staging-modelzoo.azurewebsites.net/api/"

OUTLOOK_CLIENT_ID = "a0e83608-a426-46ba-be71-040486d5c230"
OUTLOOK_TENANT_ID = "f8cdef31-a31e-4b4a-93e4-5f571e91255a"
OUTLOOK_CLIENT_SECRET = "xFT8Q~C1t-nUTGvf4Brmh5vr5tvwt5cdAgrhecL4"
OUTLOOK_SCOPES = ["https://graph.microsoft.com/Mail.Read"]
OUTLOOK_AUTH_STATUS = {"is_authenticated": False, 'total_emails': None} # Global variable to store the outlook authentication status for Electron frontend Polling

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
        self.backend = ndb.NeuralDB(low_memory=True)
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
        self.backend = ndb.NeuralDB(low_memory=True)

backend_instance: Backend = Backend()

@app.get("/check_live")
async def check_live():
    return {"message": "Backend is alive"}

@app.post("/reset_neural_db")
def reset_neural_db():
    global backend_instance

    backend_instance.reset_neural_db()

    return {"success": True, 'msg': 'Neural DB reset successful'}


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



@app.get("/highlighted_pdf_from_chat")
def highlighted_pdf_from_chat(reference_id: Optional[int] = Query(None)):
    # This method is necessary because backend_instance.current_results is not reset during chat RAG.
    # whereas during normal searcch it would reset
    # so we get the "id":47 field right before "upvote_ids":[47],

    reference = backend_instance.backend._savable_state.documents.reference(reference_id)
    buffer = io.BytesIO(hl.highlighted_pdf_bytes(reference))
    headers = {'Content-Disposition': f'inline; filename="{Path(reference.source).name}"'}
    return Response(buffer.getvalue(), headers=headers, media_type='application/pdf')

@app.get("/highlighted_pdf")
def highlighted_pdf(index: Optional[int] = Query(None)):
    global backend_instance

    # Check if index is provided and it's valid
    if index is None or index >= len(backend_instance.current_results):
        return {"error": "Invalid index provided"}
    # print('backend_instance.current_results[1].upvote_ids', backend_instance.current_results[1].upvote_ids)

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

        for index, path in enumerate(filePaths):
            if path.lower().endswith(".pdf"):
                documents.append(ndb.PDF(path))
            elif path.lower().endswith(".docx"):
                documents.append(ndb.DOCX(path))
            elif path.lower().endswith(".csv"):
                documents.append(ndb.CSV(path))

            # Calculate progress for the loading phase (75% of total progress)
            load_progress = int(75 * (index + 1) / len(filePaths))
            await websocket.send_json({
                "progress": load_progress,
                "message": 'Loading files into RAM',
                "complete": False
            })

        async def async_on_progress(fraction):
            # Calculate progress for the insertion phase (remaining 25% of total progress)
            insert_progress = 75 + int(25 * fraction)
            await websocket.send_json({
                "progress": insert_progress,
                "message": 'Indexing in progress',
                "complete": False
            })

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
                batch_size=500
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


@app.post("/load_gmail_workspace_by_id")
def load_gmail_workspace_by_id(model_data: LoadModelByID):
    global backend_instance

    workspaceID = model_data.workspaceID
    model_folder = USER_WORKSPACE_CACHE / workspaceID
    file_path = model_folder / 'model.ndb'
    
    # Check if the path exists
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Model not found.")
    
    try:
        backend_instance.gmail_query_switch = True
        backend_instance.backend = ndb.NeuralDB.from_checkpoint(
            checkpoint_path=str(file_path),
        )
    except Exception as error:
        error_msg = str(error)
        print(f"backend: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)

    return {'success': True}


class DeleteModelByID(BaseModel):
    workspaceID: str

@app.post("/delete_by_id")
def delete_by_id(model_data: DeleteModelByID):
    

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
    open_ai_api_key: Optional[str]

@app.post("/setting")
def setting(input_data: SettingInput):
    global backend_instance
    backend_instance.preferred_summary_model = input_data.model_preference
    
    if input_data.model_preference == "NONE":

        return {"success": True, "msg": f'Settings updated: model_preference: {backend_instance.preferred_summary_model}'}
    
    elif input_data.model_preference == "OpenAI": # Check if the preferred summary model is 'OpenAI'

        backend_instance.open_ai_api_key = input_data.open_ai_api_key

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

class ChatRequest(BaseModel):
    prompt: str
    session_id: str

@app.post("/chat")
def chat(request: ChatRequest):
    chat_history_sql_uri = f"sqlite:///{USER_CHAT_HISTORY_CACHE}"
    genai_key = backend_instance.open_ai_api_key

    if backend_instance.preferred_summary_model != 'OpenAI': # If summarizer is not on
        raise HTTPException(status_code=400, detail="Summarizer is not turned on.") # return an error

    if not genai_key: # If API key is not defined
        raise HTTPException(status_code=400, detail="OpenAI API key is not defined.") # return an error
        
    ct = open_ai_chat.OpenAIChat(
        backend_instance.backend, chat_history_sql_uri, USER_CHAT_HISTORY_REFERENCE_CACHE, genai_key
    )

    try:
        chat_output = ct.chat(request.prompt, request.session_id)
        response_text, references_list = chat_output
        chat_result = {"response": response_text, "references": references_list}
        return chat_result
    except Exception as e:
        # Handle other errors, e.g., errors from the OpenAIChat instance
        raise HTTPException(status_code=500, detail=str(e))

class ChatHistoryRequest(BaseModel):
    session_id: str

@app.post("/get_chat_history")
def get_chat_history(request: ChatHistoryRequest):
    if not os.path.exists(USER_CHAT_HISTORY_CACHE):
        # If the cache doesn't exist, return an empty list
        # This prevents error for the case where cache file hasn't been created yet or 
        # hasn't been populated with anything.
        return {"chat_history": [], "chat_references": []}

    chat_history_sql_uri = f"sqlite:///{USER_CHAT_HISTORY_CACHE}"
    genai_key = backend_instance.open_ai_api_key if backend_instance.open_ai_api_key else 'sk-pseudo-key'
    ct = open_ai_chat.OpenAIChat(
        backend_instance.backend, chat_history_sql_uri, USER_CHAT_HISTORY_REFERENCE_CACHE, genai_key
    )
    return ct.get_chat_history(request.session_id)

class DeleteChatHistoryRequest(BaseModel):
    session_id: str

@app.post("/delete_chat_history")
def delete_chat_history(request: DeleteChatHistoryRequest):
    try:
        chat_history_sql_uri = f"sqlite:///{USER_CHAT_HISTORY_CACHE}"
        genai_key = backend_instance.open_ai_api_key if backend_instance.open_ai_api_key else 'sk-pseudo-key'
        ct = open_ai_chat.OpenAIChat(
            backend_instance.backend, chat_history_sql_uri, USER_CHAT_HISTORY_REFERENCE_CACHE, genai_key
        )

        ct.delete_chat_history(request.session_id)
        return {"detail": "Chat history deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_email_content(emailSource, curWorkSpaceID):
    # Step 1: Locate the gmail.csv file in the workspace
    workspace_folder = USER_WORKSPACE_CACHE / curWorkSpaceID
    documents_folder = workspace_folder / 'documents'
    gmail_csv_path = documents_folder / 'gmail.csv'
    
    if not gmail_csv_path.exists():
        return "Error: gmail.csv not found."
    
    # Step 2: Extract message ID from emailSource
    message_id = emailSource.split('/')[-1]

    # Step 3: Read gmail.csv to find the email content
    email_content = ""
    with open(gmail_csv_path, mode='r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            if row['Message ID'] == message_id:
                email_content += row['Email Content'] + " "
    
    if not email_content:
        return "Error: Email content not found."

    return email_content

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
    
    try:
        data = await websocket.receive_text()
        parsed_data = json.loads(data)
        emailSource = parsed_data["emailSource"]
        curWorkSpaceID = parsed_data["curWorkSpaceID"]
        email_content = get_email_content(emailSource, curWorkSpaceID)
        
        model_preference, open_ai_api_key = backend_instance.preferred_summary_model, backend_instance.open_ai_api_key

        if model_preference == 'OpenAI':
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

    except Exception as e:
        # This captures any exception, logs it, and sends an error message to the frontend
        error_message = str(e)
        print(f"Exception in gmail_summarize: {error_message}")
        await websocket.send_text(f"Error: An unexpected error occurred - {error_message}")
    finally:
        # Ensure the WebSocket is closed after handling the request or encountering an error
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
    
    try:
        data = await websocket.receive_text()
        parsed_data = json.loads(data)
        userIntent = parsed_data["userIntent"]
        emailSource = parsed_data["emailSource"]
        curWorkSpaceID = parsed_data["curWorkSpaceID"]
        email_content = get_email_content(emailSource, curWorkSpaceID)
        
        model_preference, open_ai_api_key = backend_instance.preferred_summary_model, backend_instance.open_ai_api_key

        if model_preference == 'OpenAI':
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

    except Exception as e:
        # This captures any exception, logs it, and sends an error message to the frontend
        error_message = str(e)
        print(f"Exception in gmail_summarize: {error_message}")
        await websocket.send_text(f"Error: An unexpected error occurred - {error_message}")
    finally:
        # Ensure the WebSocket is closed after handling the request or encountering an error
        await websocket.close()

@app.post("/gmail_inbox_delete_credential")
def gmail_inbox_delete_credential():
    
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
            client_secrets_path = os.path.join(APPLICATION_PATH, 'client_secret_user_account.json')
            
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
    
    def save_credentials_to_file(user_id, credentials):
        file_path = USER_GMAIL_CACHE / f"{user_id}_token.pkl"
        with open(file_path, 'wb') as token_file:
            pickle.dump(credentials, token_file)

    # Ensure the folder exists
    USER_GMAIL_CACHE.mkdir(parents=True, exist_ok=True)

    user_id = 'me'
    client_secrets_path = os.path.join(APPLICATION_PATH, 'client_secrets.json')
    flow = InstalledAppFlow.from_client_secrets_file(
        client_secrets_path, scopes=['https://www.googleapis.com/auth/gmail.readonly'],
    )

    try:
        credentials = flow.run_local_server(port=0) # Open browser for the user to authenticate
        save_credentials_to_file(user_id, credentials) # Save the credentials for future use
    except Exception as error:
        return {"success": False, "msg": str(error)}

    # Build the Gmail API service and save it for the user
    service = build('gmail', 'v1', credentials=credentials)
    backend_instance.gmail_auth_services[user_id] = service

    return {"success": True, 'msg': 'Gmail auth successful'}

@app.post("/gmail_total_emails")
def gmail_total_emails(user_id: str = 'me'):
    service = backend_instance.gmail_auth_services.get(user_id)
    if not service:
        raise HTTPException(status_code=401, detail="User not authenticated")

    profile = service.users().getProfile(userId=user_id).execute()
    total_emails = profile.get('messagesTotal')
    return {"total_emails": total_emails}

@app.post("/save_gmail_workspace")
def save_gmail_workspace():
    def get_user_email_address(token_file_path) -> str:
        """Fetch the user's email address using their Google account profile."""

        def load_user_credentials(token_file_path):
            """Load user's credentials from a pickle file."""
            with open(token_file_path, 'rb') as token:
                return pickle.load(token)

        credentials = load_user_credentials(token_file_path)
        service = build('gmail', 'v1', credentials=credentials)
        
        try:
            profile = service.users().getProfile(userId='me').execute()
            return profile.get('emailAddress', "Unknown email account")
        except Exception as e:
            print(f"An error occurred: {e}")
            return "Unknown email account"

    workspaceID = str(uuid4())

    # Create a workspace folder
    workspace_folder = USER_WORKSPACE_CACHE / workspaceID
    workspace_folder.mkdir(parents=True, exist_ok=True)

    # Copy the auth token file to the workspace folder
    user_id = 'me'
    source_token_file = USER_GMAIL_CACHE / f"{user_id}_token.pkl"
    target_token_file = workspace_folder / f"{user_id}_token.pkl"
    if source_token_file.exists():
        shutil.copy(source_token_file, target_token_file)
    else:
        return {"success": False, "msg": "Authentication token not found."}

    # Create 'documents' folder and initialize 'gmail.csv'
    documents_folder = workspace_folder / 'documents'
    documents_folder.mkdir(exist_ok=True)
    gmail_csv_path = documents_folder / 'gmail.csv'
    with open(gmail_csv_path, mode='w', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Message ID', 'Timestamp', 'From', 'To', 'CC', 'Subject', 'Email Content'])

    email_account = get_user_email_address(target_token_file)

    metadata = {
        "workspaceID": workspaceID,
        "workspaceName": "Gmail Workspace",
        "model_info": {
            "author_name": "thirdai",
            "model_name": "Default model"
        },
        "documents": [{
            "fileName": "gmail.csv",
            "filePath": str(gmail_csv_path),
            "uuid": str(uuid4()),
            "isSaved": True
        }],
        "last_modified": datetime.utcnow().isoformat(),
        "gmailWorkspaceInfo": {
            "last_email_date": None,
            "num_emails": 0,  # Initialize to 0 as the gmail.csv is empty
            "email_account": email_account,
            "initial_download_num": 200,  # User specified or default to 200
            "is_downloading": False,
            "is_download_finished": False,
            "is_training": False,
            "is_training_finished": False,
            "is_sync": False
        }
    }

    # Write metadata to JSON file
    metadata_path = workspace_folder / 'metadata.json'
    with open(metadata_path, 'w') as json_file:
        json.dump(metadata, json_file, indent=4)
    
    # Return success response to the frontend
    return { "success": True, "metadata": metadata}

def append_emails_to_csv(service, messages, gmail_csv_path, on_progress):

    def extract_text_with_trafilatura(mime_msg):
        # Combine all parts of the email into one string
        email_content = ''
        for part in mime_msg.walk():
            charset = part.get_content_charset() or 'utf-8'
            content_type = part.get_content_type()
            if content_type in ('text/plain', 'text/html'):
                email_content += part.get_payload(decode=True).decode(charset, 'ignore')
        
        # Use trafilatura to extract text
        extracted_text = trafilatura.extract(email_content, include_formatting=False, include_comments=False, include_links=False, include_tables=False, favor_precision=True)
        return extracted_text if extracted_text else ''
    
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

    def parse_date_to_utc(date_str):
        dt = parsedate_to_datetime(date_str)
        dt_utc = dt.astimezone(timezone.utc) # Convert to UTC
        timestamp = dt_utc.isoformat() # Format as an ISO string in UTC
        
        return timestamp

    latest_email_date_iso = '1970-01-01T00:00:00+00:00'
    text_splitter = RecursiveCharacterTextSplitter(
                        chunk_size=500,
                        chunk_overlap=75,
                        length_function=len,
                    )
    
    with open(gmail_csv_path, mode='a', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)

        for idx, message_info in enumerate(messages):
            msg_id = message_info['id']

            try:
                message = fetch_gmail_message(service, msg_id)

                # Decode email
                msg_raw = base64.urlsafe_b64decode(message['raw'].encode('ASCII')) 
                mime_msg = message_from_bytes(msg_raw)

                # Extract additional details
                subject = decode_mime_header(mime_msg.get("Subject", ""))
                from_header = decode_mime_header(mime_msg.get("From", ""))
                to_header = decode_mime_header(mime_msg.get("To", ""))
                cc_header = decode_mime_header(mime_msg.get("Cc", ""))
                timestamp = parse_date_to_utc(mime_msg.get('Date'))
                text_content = extract_text_with_trafilatura(mime_msg)

                # Update latest email date if this email is more recent
                if timestamp > latest_email_date_iso:
                    latest_email_date_iso = timestamp

                if text_content:
                    if '<html' in text_content.lower():
                        # Parse the content using BeautifulSoup
                        soup = BeautifulSoup(text_content, 'html.parser')
                        # Extract the plain text
                        text_content = soup.get_text(separator=' ', strip=True)

                    # Compact the content to remove multiple newlines
                    text_content = re.sub(r'\n+', '\n', text_content)
                    texts = text_splitter.split_text(text_content)

                    for chunk in texts:
                        chunk = chunk.strip().replace("\r\n", " ").replace("\n", " ")
                        writer.writerow([msg_id, timestamp, from_header, to_header, cc_header, subject, chunk])

                progress_percentage = round((idx / len(messages)) * 100, 2)
                on_progress(progress_percentage, f"Processed {idx + 1} of {len(messages)} messages")
            
            except Exception as e:
                print(f"Failed to fetch message with ID {msg_id}. Error: {e}")
                continue  # Skip this message and move to the next
    
    return latest_email_date_iso, len(messages)

def download_emails(service, num_download, gmail_csv_path, on_progress, num_email_skip = 0):

    page_token = None
    all_messages = []
    adjusted_download_num = num_download + num_email_skip

    while True:
        results = service.users().messages().list(userId='me', pageToken=page_token).execute()
        messages = results.get('messages', [])
        if not messages:
            break
        all_messages.extend(messages)

        if len(all_messages) >= adjusted_download_num:
            break

        page_token = results.get('nextPageToken')
        if not page_token:
            break
    
    all_messages = all_messages[num_email_skip:num_download + num_email_skip]

    latest_email_date_iso, num_emails_appended = append_emails_to_csv(service, all_messages, gmail_csv_path, on_progress)

    return latest_email_date_iso, num_emails_appended

@app.websocket("/gmail_initial_download_train")
async def gmail_initial_download_train(websocket: WebSocket):
    global backend_instance

    await websocket.accept()

    async for message in websocket.iter_text():
        def on_progress(progress_percentage, message):
            asyncio.run_coroutine_threadsafe(
                websocket.send_text(json.dumps({"progress": progress_percentage, "message": message})),
                loop
            )

        data = json.loads(message)
        
        user_id = data.get('user_id', 'me')
        initial_download_num = data.get("initial_download_num", 200)
        workspace_id = data.get("workspaceid")

        gmail_csv_path = USER_WORKSPACE_CACHE / workspace_id / 'documents' / 'gmail.csv' # Locate the gmail.csv file
        metadata_path = USER_WORKSPACE_CACHE / workspace_id / 'metadata.json'
        service = backend_instance.gmail_auth_services.get(user_id)
        loop = asyncio.get_running_loop()

        if metadata_path.exists(): # Load the existing metadata, update it, and write it back
            with open(metadata_path, 'r') as file:
                metadata = json.load(file)
            
            # Update the initial_download_num in the metadata
            metadata['gmailWorkspaceInfo']['is_downloading'] = True
            metadata['gmailWorkspaceInfo']['initial_download_num'] = initial_download_num

            # Write the updated metadata back to the file
            with open(metadata_path, 'w') as file:
                json.dump(metadata, file, indent=4)

            result = await loop.run_in_executor(
                None, 
                lambda: download_emails(service, initial_download_num, gmail_csv_path, on_progress)
            )
            latest_email_date_iso, num_emails = result

        if metadata_path.exists():
            with open(metadata_path, 'r') as file:
                metadata = json.load(file)

            # Update the states accordingly
            metadata['last_modified'] = datetime.utcnow().isoformat()
            metadata['gmailWorkspaceInfo']['is_downloading'] = False
            metadata['gmailWorkspaceInfo']['is_download_finished'] = True
            metadata['gmailWorkspaceInfo']['is_training'] = True
            metadata['gmailWorkspaceInfo']['is_training_finished'] = False
            metadata['gmailWorkspaceInfo']['num_emails'] = num_emails
            metadata['gmailWorkspaceInfo']['last_email_date'] = latest_email_date_iso

            # Save the updated metadata back to the file
            with open(metadata_path, 'w') as file:
                json.dump(metadata, file, indent=4)
            
        await websocket.send_json({"progress": 100, "message": f"Finished downloading emails at {gmail_csv_path}"})

        ##############################################  Train  ##########################################

        documents = [ndb.CSV(gmail_csv_path, strong_columns = ['Subject'], weak_columns=['Email Content'], reference_columns = ['Message ID', 'Email Content'])]

        async def async_on_progress(fraction):
            progress = int(100 * fraction)
            message = "Indexing in progress"
            await websocket.send_json({"progress": progress, "message": message, "complete": False})

        def on_progress(fraction):
            loop.call_soon_threadsafe(asyncio.create_task, async_on_progress(fraction))

        def on_error(error_msg):
            loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"error": True, "message": error_msg}))

        def on_success():
            # Save the model in the workspace
            model_path = USER_WORKSPACE_CACHE / workspace_id / 'model.ndb'
            backend_instance.backend.save(model_path)

            if metadata_path.exists():
                with open(metadata_path, 'r') as file:
                    metadata = json.load(file)

                # Update the states to reflect that downloading has finished and training is complete
                metadata['gmailWorkspaceInfo']['is_downloading'] = False
                metadata['gmailWorkspaceInfo']['is_download_finished'] = True
                metadata['gmailWorkspaceInfo']['is_training'] = False
                metadata['gmailWorkspaceInfo']['is_training_finished'] = True

                # Optionally, update other relevant fields such as 'last_modified' to indicate when the training finished
                metadata['last_modified'] = datetime.utcnow().isoformat()

                # Save the updated metadata back to the file
                with open(metadata_path, 'w') as file:
                    json.dump(metadata, file, indent=4)

            # Turn on Gmail query switch
            backend_instance.gmail_query_switch = True
            loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"progress": 100, "message": "Indexing completed", "complete": True, "metadata": metadata}))

        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: backend_instance.backend.insert(
                sources=documents,
                on_progress=on_progress,
                on_error=on_error,
                on_success=on_success,
                batch_size=500,
            ))
        except Exception as e:
            await websocket.send_json({"error": True, "message": str(e)})

@app.websocket("/gmail_resume_downloading")
async def gmail_resume_downloading(websocket: WebSocket):
    global backend_instance

    def count_unique_emails(gmail_csv_path):
        unique_message_ids = set()

        try:
            with open(gmail_csv_path, mode='r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    message_id = row['Message ID']
                    unique_message_ids.add(message_id)
        except FileNotFoundError:
            print(f"File {gmail_csv_path} not found.")

        return len(unique_message_ids)

    def create_service_instance(workspaceID):
        file_path = USER_WORKSPACE_CACHE / workspaceID / "me_token.pkl"
        stored_creds = None
        credentials = None
        with open(file_path, 'rb') as token_file:
            stored_creds = pickle.load(token_file)
        
        if stored_creds and stored_creds.valid:
            credentials = stored_creds
        else:
            if stored_creds and stored_creds.expired and stored_creds.refresh_token:
                try:
                    stored_creds.refresh(Request())
                    credentials = stored_creds
                    with open(file_path, 'wb') as token_file:
                        pickle.dump(credentials, token_file)
                except Exception as e:
                    return {"success": False, "msg": f"Failed to refresh credentials: {str(e)}"}

        service = build('gmail', 'v1', credentials=credentials)

        return service

    def get_latest_email_date(gmail_csv_path):
        latest_email_date_iso = '1970-01-01T00:00:00+00:00'  # This is a base comparison string
        try:
            with open(gmail_csv_path, mode='r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    timestamp = row['Timestamp']
                    if timestamp > latest_email_date_iso:
                        latest_email_date_iso = timestamp
        except FileNotFoundError:
            print(f"File {gmail_csv_path} not found.")
        return latest_email_date_iso

    def list_messages_matching_query(service, user_id, query=''):
        try:
            response = service.users().messages().list(userId=user_id, q=query).execute()
            messages = response.get('messages', [])
            return messages
        except error as error:
            print(f'An error occurred: {error}')
            return []

    def fetch_emails_after_date(service, gmail_csv_path, user_id='me'):
        latest_email_date_iso = get_latest_email_date(gmail_csv_path)
        # Convert ISO date to epoch in milliseconds for the Gmail query
        latest_email_datetime = datetime.fromisoformat(latest_email_date_iso)
        query = f"after:{int(latest_email_datetime.timestamp())}"
        
        messages = list_messages_matching_query(service, user_id, query)

        return messages

    await websocket.accept()

    async for message in websocket.iter_text():
        def on_progress(progress_percentage, message):
            asyncio.run_coroutine_threadsafe(
                websocket.send_text(json.dumps({"progress": progress_percentage, "message": message})),
                loop
            )

        data = json.loads(message)

        workspace_id = data.get("workspaceid")
        metadata_path = USER_WORKSPACE_CACHE / workspace_id / 'metadata.json'
        gmail_csv_path = USER_WORKSPACE_CACHE / workspace_id / 'documents' / 'gmail.csv'
        service = create_service_instance(workspace_id)
        loop = asyncio.get_running_loop()

        if not metadata_path.exists() or not gmail_csv_path.exists():
            raise HTTPException(status_code=404, detail="Workspace or gmail.csv not found.")

        with open(metadata_path, 'r') as file:
            metadata = json.load(file)

        if not metadata['gmailWorkspaceInfo'].get('is_sync', False): # Check if is_sync is false
            # Determine the number of emails already downloaded
            existing_emails_count = count_unique_emails(gmail_csv_path)

            initial_download_num = metadata['gmailWorkspaceInfo'].get('initial_download_num', 200)
            emails_to_download = initial_download_num - existing_emails_count

            if emails_to_download > 0:
                # Download additional emails and append them to gmail.csv
                await loop.run_in_executor(
                    None,
                    lambda: download_emails(service, emails_to_download, gmail_csv_path, on_progress, num_email_skip = existing_emails_count)
                )

                # Update metadata after downloading
                if metadata_path.exists():
                    with open(metadata_path, 'r') as file:
                        metadata = json.load(file)

                    metadata['gmailWorkspaceInfo']['is_downloading'] = False
                    metadata['gmailWorkspaceInfo']['is_download_finished'] = True
                    metadata['gmailWorkspaceInfo']['is_training'] = True
                    metadata['gmailWorkspaceInfo']['is_training_finished'] = False
                    metadata['gmailWorkspaceInfo']['num_emails'] = initial_download_num
                    metadata['last_modified'] = datetime.utcnow().isoformat()
                    metadata['gmailWorkspaceInfo']['last_email_date'] = get_latest_email_date(gmail_csv_path)

                    with open(metadata_path, 'w') as file:
                        json.dump(metadata, file, indent=4)

                await websocket.send_json({"progress": '100', "message": 'finished downloading', "complete": True, 'metadata': metadata})
            else:
                await websocket.send_json({"progress": '100', "message": 'No additional emails needed to be downloaded.', "complete": True})
        else:
            # If is_sync is true
            messages = fetch_emails_after_date(service, gmail_csv_path)
            result = await loop.run_in_executor(
                    None,
                    lambda: append_emails_to_csv(service, messages, gmail_csv_path, on_progress)
            )
            latest_email_date_iso, num_emails_sync = result
            
            # Update metadata after downloading
            if metadata_path.exists():
                with open(metadata_path, 'r') as file:
                    metadata = json.load(file)

                metadata['gmailWorkspaceInfo']['is_downloading'] = False
                metadata['gmailWorkspaceInfo']['is_download_finished'] = True
                metadata['gmailWorkspaceInfo']['is_training'] = True
                metadata['gmailWorkspaceInfo']['is_training_finished'] = False
                metadata['gmailWorkspaceInfo']['num_emails'] += num_emails_sync
                metadata['last_modified'] = datetime.utcnow().isoformat()
                metadata['gmailWorkspaceInfo']['last_email_date'] = latest_email_date_iso

                with open(metadata_path, 'w') as file:
                    json.dump(metadata, file, indent=4)
            await websocket.send_json({"progress": '100', "message": 'finished sync downloading emails', "complete": True, 'metadata': metadata})

@app.websocket("/gmail_resume_training")
async def gmail_resume_training(websocket: WebSocket):
    await websocket.accept()

    async def async_on_progress(fraction):
        progress = int(100 * fraction)
        message = "Indexing in progress"
        await websocket.send_json({"progress": progress, "message": message, "complete": False})

    def on_progress(fraction):
        loop.call_soon_threadsafe(asyncio.create_task, async_on_progress(fraction))

    def on_error(error_msg):
        loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"error": True, "message": error_msg}))

    def on_success():
        # Move the trained model to the target location
        if checkpoint_dir.exists():
            if target_model_path.exists():
                shutil.rmtree(target_model_path)  # Remove the existing model directory
            shutil.move(str(checkpoint_dir / 'trained.ndb'), str(target_model_path))  # Move the new model to the target location
            shutil.rmtree(checkpoint_dir) # Remove the saved_training_model directory

        if metadata_path.exists():
            with open(metadata_path, 'r') as file:
                metadata = json.load(file)

            # Update the states accordingly
            metadata['last_modified'] = datetime.utcnow().isoformat()
            metadata['gmailWorkspaceInfo']['is_training'] = False
            metadata['gmailWorkspaceInfo']['is_training_finished'] = True
            metadata['gmailWorkspaceInfo']['is_sync'] = False

            # Save the updated metadata back to the file
            with open(metadata_path, 'w') as file:
                json.dump(metadata, file, indent=4)
        loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"progress": 100, "message": "Resumed training completed successfully", "complete": True, "metadata": metadata}))

    async for message in websocket.iter_text():
        data = json.loads(message)

        workspace_id = data.get("workspaceid")
        workspace_folder = USER_WORKSPACE_CACHE / workspace_id
        metadata_path = workspace_folder / 'metadata.json'
        gmail_file_path = str(workspace_folder / 'documents' / 'gmail.csv')
        checkpoint_dir = workspace_folder / "saved_training_model"
        docs_to_insert = [ndb.CSV(gmail_file_path, strong_columns = ['Subject'], weak_columns=['Email Content'], reference_columns = ['Message ID', 'Email Content'])]
        checkpoint_config = ndb.CheckpointConfig(
            checkpoint_dir=checkpoint_dir,
            resume_from_checkpoint=checkpoint_dir.exists() and any(checkpoint_dir.iterdir()),
            checkpoint_interval=1,
        )
        target_model_path = workspace_folder / 'model.ndb'
        loop = asyncio.get_running_loop()

        try:
            # Resume training
            db = ndb.NeuralDB(low_memory = True)
            loop.run_in_executor(None, lambda: db.insert(
                sources=docs_to_insert,
                train=True,
                on_progress=on_progress,
                on_error=on_error,
                on_success=on_success,
                batch_size=500
                # checkpoint_config=checkpoint_config
            ))
        except Exception as e:
            await websocket.send_json({"error": str(e)})

class GmailSync(BaseModel):
    workspaceID: str

@app.post("/gmail_sync")
def gmail_sync(data: GmailSync):
    workspace_id = data.workspaceID
    metadata_path = USER_WORKSPACE_CACHE / workspace_id / 'metadata.json'

    if metadata_path.exists(): # Load the existing metadata, update it, and write it back
        with open(metadata_path, 'r') as file:
            metadata = json.load(file)
        
        # Update the initial_download_num in the metadata
        metadata['gmailWorkspaceInfo']['is_sync'] = True

        # Write the updated metadata back to the file
        with open(metadata_path, 'w') as file:
            json.dump(metadata, file, indent=4)

    return {"success": True}


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
                batch_size=500,
            ))
        except Exception as e:
            await websocket.send_json({"error": True, "message": str(e)})


if __name__ == "__main__":
    multiprocessing.freeze_support()

    backend_instance = Backend()

    FASTAPI_LOCALHOST_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    WORKING_FOLDER = Path(sys.argv[2]) if len(sys.argv) > 2 else WORKING_FOLDER
    USER_WORKSPACE_CACHE = WORKING_FOLDER / "user_workspace_cache"
    USER_GMAIL_CACHE = WORKING_FOLDER / "user_gmail_cache"
    USER_GMAIL_LOGIN_CACHE = WORKING_FOLDER / "user_gmail_login_cache"
    USER_CHAT_HISTORY_CACHE = WORKING_FOLDER / "chat_cache" / "chat_history.db"
    USER_CHAT_HISTORY_REFERENCE_CACHE = WORKING_FOLDER / "chat_cache" / "chat_reference.json"

    OUTLOOK_REDIRECT_URI = f"http://localhost:{FASTAPI_LOCALHOST_PORT}/outlook_callback"

    os.makedirs(os.path.dirname(USER_CHAT_HISTORY_CACHE), exist_ok=True)
    os.makedirs(os.path.dirname(USER_CHAT_HISTORY_REFERENCE_CACHE), exist_ok=True)

    print(f'backend: FASTAPI_LOCALHOST_PORT = {FASTAPI_LOCALHOST_PORT}')
    print(f'backend: WORKING_FOLDER = {WORKING_FOLDER}')

    # Configure WebSocket ping interval and timeout
    websocket_ping_interval = 300  # Ping every 5 minutes
    websocket_ping_timeout = 1200   # Timeout after 20 minutes of no response

    uvicorn.run(app, host="0.0.0.0", port=FASTAPI_LOCALHOST_PORT,
                ws_ping_interval=websocket_ping_interval,
                ws_ping_timeout=websocket_ping_timeout)