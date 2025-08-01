from typing import Callable
from fastapi import WebSocket
import asyncio


class QA:
    def answer(self, question: str, context: str, on_error: Callable) -> str:
        raise NotImplementedError()


class T5(QA):
    def __init__(self, **kwargs):
        # from transformers import AutoTokenizer, AutoModelForConditionalGeneration, AutoModelWithLMHead
        # t5_model_name = "MaRiOrOsSi/t5-base-finetuned-question-answering"
        # self.model = AutoModelWithLMHead.from_pretrained(t5_model_name)
        # self.tokenizer = AutoTokenizer.from_pretrained(t5_model_name)
        from transformers import T5ForConditionalGeneration, T5Tokenizer

        t5_model_name = "t5-large"
        self.model = T5ForConditionalGeneration.from_pretrained(t5_model_name)
        self.tokenizer = T5Tokenizer.from_pretrained(t5_model_name)

    def answer(self, question: str, context: str, on_error: Callable, **kwargs):
        to_summarize = f"question: {question} context: {context}"
        encoded_input = self.tokenizer(
            [to_summarize], return_tensors="pt", max_length=512, truncation=True
        )

        output = self.model.generate(
            input_ids=encoded_input.input_ids,
            attention_mask=encoded_input.attention_mask,
        )

        yield self.tokenizer.decode(output[0], skip_special_tokens=True)


class OpenAI(QA):
    def __init__(self, key, **kwargs) -> None:
        if not key:
            raise ValueError("OpenAI key required.")

        from openai import OpenAI
        
        client = OpenAI(api_key=key)

        self.openai = client

        self.default_prompt = (
            "Write an answer that is about 100 words "
            "for the question below based on the provided context. "
            "If the context provides insufficient information, "
            'reply "I cannot answer", and give a reason why.'
            "Answer in an unbiased, comprehensive, and scholarly tone. "
            "If the question is subjective, provide an opinionated answer in the concluding 1-2 sentences."
            "If the given question is not answerable or is not a question, simply summarize the given context as coherently as possible."
        )

        self.prompt_template = (
            "{prompt}\n\n" "Context: {context}\n" "Question: {question}\n" "Answer: "
        )

    def answer(
        self, question: str, context: str, on_error: Callable, model='gpt-4o-mini', prompt=None, **kwargs
    ) -> str:
        try:
            from openai import OpenAI

            client = self.openai
            from nltk.tokenize import word_tokenize as nlkt_word_tokenize

            context_words = nlkt_word_tokenize(context)
            # OpenAI model we use has max tokens of ~4k, so we limit # words to 2k
            context_words = context_words[:2000]
            context_shortened = " ".join(context_words)

            if not prompt:
                prompt = self.default_prompt

            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": self.prompt_template.format(
                            prompt=prompt,
                            context=context_shortened,
                            question=question,
                        ),
                    }
                ],
                temperature=0.1,
                stream=True,
            )

            response_message = ""
            for chunk in response:
                response_message += str(chunk.choices[0].delta.get("content", ""))
                yield response_message

        except Exception as error:
            on_error("backend: Error in OpenAI Summarizer")
            raise error

    async def stream_answer(self, question: str, context: str, websocket: WebSocket, on_error: Callable, model='gpt-4o-mini', prompt=None, **kwargs):
        try:
            from openai import OpenAI
            
            client = self.openai
            from nltk.tokenize import word_tokenize as nlkt_word_tokenize

            context_words = nlkt_word_tokenize(context)
            # OpenAI model we use has max tokens of ~4k, so we limit # words to 2k
            context_words = context_words[:2000]
            context_shortened = " ".join(context_words)

            if not prompt:
                prompt = self.default_prompt

            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": self.prompt_template.format(
                            prompt=prompt,
                            context=context_shortened,
                            question=question,
                        ),
                    }
                ],
                temperature=0.1,
                stream=True,
            )

            # print("Response from OpenAI:", response)

            async def async_generator(sync_iterator):
                try:
                    for chunk in sync_iterator:
                        # DEBUG: Check if chunks are being received
                        # print("Chunk received:", chunk)
                        yield chunk
                        await asyncio.sleep(0)  # Yield control to the event loop
                except Exception as e:
                    # print("Error in async_generator:", e)  # DEBUG: Log exception
                    on_error(f"backend: Error in OpenAI Summarizer - {e}")
                    raise

            full_msg = ''

            # Use the async_generator to asynchronously stream results
            async for chunk in async_generator(response):
                if hasattr(chunk, 'choices'):  # Check if the 'choices' attribute exists
                    for choice in chunk.choices:
                        if hasattr(choice, 'delta'):  # Check if the 'delta' attribute exists
                            if hasattr(choice, 'delta'):  # Check if the 'delta' attribute exists
                                delta_content = choice.delta.content if hasattr(choice.delta, 'content') else ''
                                if delta_content:  # Ensure there's actual content
                                    full_msg += delta_content
                                    await websocket.send_text(full_msg)

        except Exception as error:
            print("Error in stream_answer:", error)  # DEBUG: Log exception
            on_error("backend: Error in OpenAI Summarizer")
            raise error

class Dolly(QA):
    def __init__(self, **kwargs) -> None:
        from langchain import LLMChain, PromptTemplate
        from langchain.llms import HuggingFacePipeline
        from transformers import pipeline

        generate_text = pipeline(
            model="databricks/dolly-v2-3b",
            trust_remote_code=True,
            device_map="auto",
            return_full_text=True,
        )
        llm = HuggingFacePipeline(pipeline=generate_text)
        prompt_with_context = PromptTemplate(
            input_variables=["instruction", "context"],
            template="{instruction}\n\nInput:\n{context}",
        )
        self.chain = LLMChain(llm=llm, prompt=prompt_with_context)

    def answer(self, question: str, context: str, on_error: Callable, **kwargs) -> str:
        yield self.chain.predict(
            instruction="answer from context: " + question, context=context
        ).lstrip()


class UDTEmbedding(QA):
    def __init__(self, get_model, get_query_col, **kwargs) -> None:
        self.get_model = get_model
        self.get_query_col = get_query_col

    def answer(self, question: str, context: str, on_error: Callable, **kwargs) -> str:
        try:
            # ignore question
            from parsing_utils import summarize

            summary = summarize.summarize(
                context, self.get_model(), query_col=self.get_query_col()
            ).strip()

            yield " ".join(
                [sent.strip() for sent in summarize.nlkt_sent_tokenize(summary)]
            )
        except Exception as error:
            on_error("backend: Error in UDT Embedding Summarizer")
            raise error
