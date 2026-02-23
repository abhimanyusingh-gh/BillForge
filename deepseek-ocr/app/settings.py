from dataclasses import dataclass
import os


def read_bool(name: str, default: bool) -> bool:
  raw = os.getenv(name)
  if raw is None:
    return default
  return raw.strip().lower() == "true"


@dataclass(frozen=True)
class Settings:
  model_id: str
  text_prompt: str
  layout_prompt: str
  device: str
  torch_dtype: str
  max_new_tokens: int
  load_on_startup: bool


settings = Settings(
  model_id=os.getenv("OCR_MODEL_ID", "deepseek-ai/DeepSeek-OCR"),
  text_prompt=os.getenv("OCR_TEXT_PROMPT", "<image>\nExtract all visible text from this document."),
  layout_prompt=os.getenv(
    "OCR_LAYOUT_PROMPT",
    "<image>\n<|grounding|>Extract each readable text block verbatim in reading order."
  ),
  device=os.getenv("OCR_DEVICE", "auto").strip().lower(),
  torch_dtype=os.getenv("OCR_TORCH_DTYPE", "float16").strip().lower(),
  max_new_tokens=int(os.getenv("OCR_MAX_NEW_TOKENS", "512")),
  load_on_startup=read_bool("OCR_LOAD_ON_STARTUP", False)
)
