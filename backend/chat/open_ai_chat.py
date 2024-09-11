from langchain_openai import ChatOpenAI
from thirdai import neural_db as ndb

from .chat_interface import ChatInterface


class OpenAIChat(ChatInterface):
    def __init__(
        self,
        db: ndb.NeuralDB,
        chat_history_sql_uri: str,
        chat_ref_file_path: str,
        openai_api_key: str,
        top_k: int = 5,
        openai_model: str = "gpt-4o-mini",
        temperature: float = 0.2,
        chat_prompt: str = "Answer the user's questions based on the below context:",
        query_reformulation_prompt: str = "Given the above conversation, generate a search query that would help retrieve relevant sources for responding to the last message.",
    ):
        # Set instance variables necessary for self.llm() before calling super().__init__(),
        # because super().__init__() calls self.llm()
        self.openai_model = openai_model
        self.openai_api_key = openai_api_key
        self.temperature = temperature

        super().__init__(
            db, chat_history_sql_uri, chat_ref_file_path, top_k, chat_prompt, query_reformulation_prompt
        )

    def llm(self):
        return ChatOpenAI(
            model=self.openai_model,
            temperature=self.temperature,
            openai_api_key=self.openai_api_key,
        )
