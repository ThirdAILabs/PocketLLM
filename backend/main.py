####### To package this file, run "pyinstaller main.spec" #######

import os
import sys
import json
import asyncio
from fastapi import FastAPI, WebSocket, HTTPException
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
import base64
from bs4 import BeautifulSoup
import re
import csv
from email import message_from_bytes
from retrying import retry
import tempfile

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


@app.websocket("/index_files")
async def index_files(websocket: WebSocket):
    await websocket.accept()

    global backend_instance

    # If previously trained on Gmail, reset neuraldb
    if backend_instance.gmail_query_switch:
        backend_instance.reset_neural_db()

    async for message in websocket.iter_text():
        data = json.loads(message)
        if data.get("startComputation"):
            filePaths = data.get("filePaths", [])

            documents = []

            for path in filePaths:
                if path.lower().endswith(".pdf"):
                    documents.append(ndb.PDF(path))
                elif path.lower().endswith(".docx"):
                    documents.append(ndb.DOCX(path))
                elif path.lower().endswith(".csv"):
                    documents.append(ndb.CSV(path))
                # elif path.lower().endswith(".mbox"):
                    # documents.append(ndb.MBOX(path))

            async def async_on_progress(fraction):
                progress = int(100 * fraction)
                message = "Indexing in progress"
                await websocket.send_json({"progress": progress, "message": message})

            def on_progress(fraction):
                loop.call_soon_threadsafe(asyncio.create_task, async_on_progress(fraction))

            def on_error(error_msg):
                loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"error": True, "message": error_msg}))

            def on_success():
                # Turn off Gmail query switch
                backend_instance.gmail_query_switch = False
                loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"progress": 100, "message": "Indexing completed"}))

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
async def query(query_model: QueryModel):    
    global backend_instance

    # Handle the case when backend_instance is None
    if backend_instance is None:
        raise HTTPException(status_code=400, detail="Backend instance is not initialized")

    search_str = query_model.search_str

    backend_instance.current_query = search_str

    print(f'backend: searching "{search_str}"')

    query, _ = parse_prompt(search_str)

    references = backend_instance.backend.search(
        query=query, top_k=10, on_error=lambda s: print(f"backend: {s}")
    )

    backend_instance.current_results = references

    results = []

    if backend_instance.gmail_query_switch:
        for ref in references:
            ref_text = ref.text

            email_content_index = ref_text.find("Email Content:")
            msg_id = ref_text[len('Message ID: '): email_content_index].strip()
            email_content = ref_text[email_content_index + len('Email Content:'):].strip()

            results.append({"result_text": email_content, "result_source": f'https://mail.google.com/mail/u/0/?tab=rm&ogbl#inbox/{msg_id}'})
    else:
        results = [
            {
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
async def teach(teach_model: TeachModel):
    global backend_instance

    # Handle the case when backend_instance is None
    if backend_instance is None:
        raise HTTPException(status_code=400, detail="Backend instance is not initialized")

    source_str = teach_model.source_str
    target_str = teach_model.target_str

    print(f'backend: training association between "{source_str}" and "{target_str}"')

    try:
        references = backend_instance.backend.search(
            query=target_str, top_k=2, on_error=lambda s: print(f"backend: {s}")
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
async def save(path: SaveModel):
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

    return {'success': True, 'source_files': list(backend_instance.backend.sources().values())}


@app.post("/fetch_model_cards")
async def fetch_model_cards():
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
    return {"success": True, 
            "msg": f'Backend use model {domain}/{author_username}/{model_name}'}

@app.post("/fetch_meta_cache_model")
def fetch_meta_cache_model():
    return backend_instance.bazaar.fetch_meta_cache_model()

class SettingInput(BaseModel):
    model_preference: str
    open_ai_api_key: str

@app.post("/setting")
async def setting(input_data: SettingInput):
    global backend_instance
    backend_instance.open_ai_api_key = input_data.open_ai_api_key
    backend_instance.preferred_summary_model = input_data.model_preference
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
            context="\n".join([ref.text for ref in backend_instance.current_results]),
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
        results = model.answer(
            prompt=summary_prompt,
            question=summary_query,
            context="\n".join([ref.text for ref in backend_instance.current_results]),
            on_error=reset_summarizers,
        )

        for result in results:
            await websocket.send_text(result)

        await websocket.close()

@app.post('/gmail_auth')
async def gmail_auth():
    global backend_instance

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
        # Build the Gmail API service and save it for the user
        service = build('gmail', 'v1', credentials=credentials)
        user_id = 'me'
        backend_instance.gmail_auth_services[user_id] = service

        return {"success": True, 'msg': 'Gmail auth successful'}
    except Exception as error:
        return {"success": False, "msg": str(error)}

@app.post("/gmail_total_emails")
async def gmail_total_emails(user_id: str = 'me'):
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

        # Open a CSV file in write mode
        with tempfile.NamedTemporaryFile(mode='w', delete=True, suffix='.csv', encoding='utf-8') as csvfile:
            temp_file_location = csvfile.name

            writer = csv.writer(csvfile)

            # Write a header row to the CSV file
            writer.writerow(['Message ID', 'Email Content'])

            # Iterate over each message ID and fetch the message content
            for idx, message_info in enumerate(all_messages):
                msg_id = message_info['id']

                try:
                    message = fetch_gmail_message(service, msg_id)
        

                    # Extract the raw email data from the message and decode it
                    msg_raw = base64.urlsafe_b64decode(message['raw'].encode('ASCII'))

                    # Parse the raw email to get a MIME message object
                    mime_msg = message_from_bytes(msg_raw)

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
                        writer.writerow([msg_id, text_content])

                    await send_progress_update(round( (idx / len(all_messages)) * 100, 2), f"Processed {idx} of {len(all_messages)} messages")
                
                except Exception as e:
                    print(f"Failed to fetch message with ID {msg_id}. Error: {e}")
                    continue  # Skip this message and move to the next

            await send_progress_update(100, f"Finished processing {len(all_messages)} messages saved at {temp_file_location}")

            ##############################################  Train  ##########################################

            # Reset neuraldb to make sure previously trained files are not included.
            backend_instance.reset_neural_db()

            documents = [ndb.CSV(temp_file_location, strong_columns = ['Email Content'], reference_columns = ['Message ID', 'Email Content'])]

            async def async_on_progress(fraction):
                progress = int(100 * fraction)
                message = "Indexing in progress"
                await websocket.send_json({"progress": progress, "message": message})

            def on_progress(fraction):
                loop.call_soon_threadsafe(asyncio.create_task, async_on_progress(fraction))

            def on_error(error_msg):
                loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"error": True, "message": error_msg}))

            def on_success():
                # Turn on Gmail query switch
                backend_instance.gmail_query_switch = True
                loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"progress": 100, "message": "Indexing completed"}))

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

@app.websocket("/url_train")
async def url_train(websocket: WebSocket):
    await websocket.accept()

    global backend_instance

    # If previously trained on Gmail, reset neuraldb
    if backend_instance.gmail_query_switch:
        backend_instance.reset_neural_db()

    async def async_on_progress(fraction):
        progress = int(100 * fraction)
        message = "Indexing in progress"
        await websocket.send_json({"progress": progress, "message": message})

    def on_progress(fraction):
        loop.call_soon_threadsafe(asyncio.create_task, async_on_progress(fraction))

    def on_error(error_msg):
        loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"error": True, "message": error_msg}))

    def on_success():
        # Turn off Gmail query switch
        backend_instance.gmail_query_switch = False
        loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"progress": 100, "message": "Indexing completed"}))

    async for message in websocket.iter_text():
        data = json.loads(message)

        url = data.get('url')

        documents = [ndb.URL(url = url)]

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
    backend_instance = Backend()

    port_number = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

    print(f'backend: port_number = {port_number}')

    uvicorn.run(app, host="0.0.0.0", port=port_number)