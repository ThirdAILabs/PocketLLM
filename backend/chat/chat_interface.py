import os
import json

from abc import ABC, abstractmethod
from typing import List

from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.docstore.document import Document
from langchain_community.vectorstores import NeuralDBVectorStore
from langchain_community.chat_message_histories import SQLChatMessageHistory
from langchain_core.language_models.llms import LLM
from langchain_core.messages import AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableBranch, RunnablePassthrough
from thirdai import neural_db as ndb

class ChatReferenceManager:
    def __init__(self, cache_file_path):
        self.cache_file_path = cache_file_path
        os.makedirs(os.path.dirname(cache_file_path), exist_ok=True) # Ensure the directory exists

    def load_references(self):
        """Load the chat reference data from the JSON file, returning an empty dict if the file does not exist."""
        if not self.cache_file_path.is_file():
            return {}
        with open(self.cache_file_path, 'r') as file:
            return json.load(file)

    def save_references(self, references):
        """Save the updated chat reference data to the JSON file."""
        with open(self.cache_file_path, 'w') as file:
            json.dump(references, file, indent=4)

    def update_reference(self, session_id, ai_answer, filtered_doc_ref_info):
        """Update the chat reference file with a new entry for a specific session."""
        references = self.load_references()
        if session_id not in references:
            references[session_id] = []
        
        new_reference_entry = {
            "ai_answer": ai_answer,
            "ai_refs": filtered_doc_ref_info
        }

        # Append the new entry to this session's list of references
        references[session_id].append(new_reference_entry)
        self.save_references(references)
    
    def delete_chat_history_references(self, session_id):
        """Deletes the retrieval history associated with the given session_id."""
        references = self.load_references()
        if session_id in references:
            del references[session_id]
            self.save_references(references)

    def get_references_by_session_id(self, session_id: str):
        """Get the retrieval history references associated with the given session_id."""
        references = self.load_references()
        return references.get(session_id, [])

class ChatInterface(ABC):
    def __init__(
        self,
        db: ndb.NeuralDB,
        chat_history_sql_uri: str,
        chat_ref_file_path: str,
        top_k: int = 5,
        chat_prompt: str = "Answer the user's questions based on the below context:",
        query_reformulation_prompt: str = "Given the above conversation, generate a search query that would help retrieve relevant sources for responding to the last message.",
    ):
        self.chat_history_sql_uri = chat_history_sql_uri
        self.chat_reference_manager = ChatReferenceManager(chat_ref_file_path)
        vectorstore = NeuralDBVectorStore(db)
        retriever = vectorstore.as_retriever(search_kwargs={"k": top_k})

        query_transform_prompt = ChatPromptTemplate.from_messages(
            [
                MessagesPlaceholder(variable_name="messages"),
                (
                    "user",
                    query_reformulation_prompt,
                ),
            ]
        )

        query_transforming_retriever_chain = RunnableBranch(
            (
                lambda x: len(x.get("messages", [])) == 1,
                # If only one message, then we just pass that message's content to retriever
                (lambda x: x["messages"][-1].content) | retriever,
            ),
            # If messages, then we pass inputs to LLM chain to transform the query, then pass to retriever
            query_transform_prompt | self.llm() | StrOutputParser() | retriever,
        ).with_config(run_name="chat_retriever_chain")

        question_answering_prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    chat_prompt + "\n\n{context}",
                ),
                MessagesPlaceholder(variable_name="messages"),
            ]
        )

        document_chain = create_stuff_documents_chain(
            self.llm(), question_answering_prompt
        )

        self.references = []
        self.conversational_retrieval_chain = RunnablePassthrough.assign(
            context=query_transforming_retriever_chain
            | self.parse_retriever_output,
        ).assign(
            answer=document_chain,
        )

    @abstractmethod
    def llm(self) -> LLM:
        raise NotImplementedError()

    def parse_retriever_output(self, documents: List[Document]):
        top_k_docs = documents
        filtered_docs = []

        # print(documents)

        for doc in top_k_docs:
            if 'Message ID' in doc.metadata['metadata']:
                msg_id = doc.metadata['metadata']['Message ID']
                email_subject = doc.metadata['metadata']['Subject']

                filtered_doc_info = {
                    'reference_type': 'Gmail',
                    'reference_link': f'https://mail.google.com/mail/u/0/?tab=rm&ogbl#inbox/{msg_id}',
                    'email_subject': email_subject
                }
            elif 'title' in doc.metadata['metadata']:
                reference_link = doc.metadata['metadata']['source']
                website_title = doc.metadata['metadata']['title']

                filtered_doc_info = {
                    'reference_type': 'URL',
                    'reference_link': reference_link,
                    'website_title': website_title,
                }
            else:
                doc_id = doc.metadata['id']
                # file_path = doc.metadata['metadata']['source']
                file_path = doc.metadata['source']
                page = doc.metadata.get('metadata', {}).get('page', 1) # hack: if page field doesn't exist, set it to 1

                filtered_doc_info = {
                    'reference_type': 'File',
                    'id': doc_id,
                    'file_path': file_path,
                    'page': page
                }

            filtered_docs.append(filtered_doc_info)
        
        # The chatbot currently doesn't utilize any metadata, so we delete it to save memory
        for doc in top_k_docs:
            doc.metadata = {}

        self.references = filtered_docs

        return top_k_docs

    def get_chat_history(self, session_id: str, **kwargs):
        chat_history = SQLChatMessageHistory(
            session_id=session_id, connection_string=self.chat_history_sql_uri
        )
        chat_history_list = [
            {
                "content": message.content,
                "sender": "AI" if isinstance(message, AIMessage) else "human",
            }
            for message in chat_history.messages
        ]

        return {
            "chat_history": chat_history_list,
            "chat_references": self.chat_reference_manager.get_references_by_session_id(session_id)
        }

    def delete_chat_history(self, session_id: str, **kwargs) -> None:
        """
        Deletes the entire chat history associated with the given session_id.
        """
        chat_history = SQLChatMessageHistory(
            session_id=session_id, connection_string=self.chat_history_sql_uri
        )
        
        # Use the existing clear method to delete the chat history
        chat_history.clear()
        self.chat_reference_manager.delete_chat_history_references(session_id)

    def chat(self, user_input: str, session_id: str, **kwargs):
        chat_history = SQLChatMessageHistory(
            session_id=session_id, connection_string=self.chat_history_sql_uri
        )
        chat_history.add_user_message(user_input)
        response = self.conversational_retrieval_chain.invoke(
            {"messages": chat_history.messages}
        )
        chat_history.add_ai_message(response["answer"])

        self.chat_reference_manager.update_reference(session_id, response["answer"], self.references)

        return response["answer"], self.chat_reference_manager.get_references_by_session_id(session_id)
