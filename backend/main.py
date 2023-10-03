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

    def index_pdf(self,path: str):
        documents = [ndb.PDF(path)]
        self.backend.insert(sources=documents)

    def index_mbox(self, path: str):
        documents = [ndb.MBOX(path)]
        self.backend.insert(sources=documents)

backend_instance: Optional[Backend] = None

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

    async for message in websocket.iter_text():
        data = json.loads(message)
        if data.get("startComputation"):
            backend_instance = Backend()

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
                # asyncio.run_coroutine_threadsafe(websocket.send_json({"error": True, "message": error_msg}), asyncio.get_event_loop())
                loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json({"error": True, "message": error_msg}))

            def on_success():
                # asyncio.run_coroutine_threadsafe(websocket.send_json({"progress": 100, "message": "Indexing completed"}), asyncio.get_event_loop())
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
            "modelSize": bazaar_entry.size // 1000000,
            "modelSizeInMemory": bazaar_entry.size_in_memory // 1000000,
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

if __name__ == "__main__":
    backend_instance = Backend()

    port_number = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

    print(f'backend: port_number = {port_number}')

    uvicorn.run(app, host="0.0.0.0", port=port_number)