import fitz
from typing import Dict
import ast
from thirdai.neural_db import Reference
    
def highlighted_pdf_bytes(reference: Reference):
    if "highlight" not in reference.metadata:
        return None
    highlight = ast.literal_eval(reference.metadata["highlight"])
    doc = fitz.open(reference.source)
    for key, val in highlight.items():
        page = doc[key]
        blocks = page.get_text("blocks")
        for i, b in enumerate(blocks):
            if i in val:
                rect = fitz.Rect(b[:4])
                page.add_highlight_annot(rect)
    return doc.tobytes()

def highlight_url(url: str, reference_text: str) -> str:
    ref_text = reference_text.replace("/^[^a-z\d]*|[^a-z\d]*$/gi", "")

    start_text_idx = ref_text.find(" ", ref_text.find(" ") + 1)
    if start_text_idx != -1:
        start_text = ref_text[:start_text_idx]
    else:
        start_text = ref_text

    end_text_idx = ref_text.rfind(" ")
    if end_text_idx != -1:
        end_text = ref_text[end_text_idx + 1:]

        end_text_idx = ref_text.rfind(" ", 0, end_text_idx)
        if end_text_idx != -1:
            end_text = ref_text[end_text_idx + 1:]
    else:
        end_text = ref_text

    highlightedURL = f"{url}#:~:text={start_text},{end_text}"
    return highlightedURL