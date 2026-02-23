import ast
import base64
import io
import json
import os
import re
import shutil
import tempfile
import time
from threading import Lock
from typing import Any

from fastapi import HTTPException
from PIL import Image
from pypdf import PdfReader
import torch

from .logging import log_error, log_info
from .settings import settings

GROUNDING_BLOCK_PATTERN = re.compile(
  r"<\|ref\|>(?P<label>.*?)<\|/ref\|><\|det\|>(?P<det>.*?)<\|/det\|>(?P<body>.*?)(?=<\|ref\|>|\Z)",
  re.DOTALL
)
_CUDA_PATCHED = False


class LocalOcrEngine:
  def __init__(self, model_id: str) -> None:
    self.model_id = model_id
    self.device = resolve_device()
    self.lock = Lock()
    self.loaded = False
    self.loading = False
    self.last_error = ""
    self.mode = ""
    self.model: Any = None
    self.tokenizer: Any = None

  def ensure_loaded(self) -> None:
    if self.loaded:
      return

    with self.lock:
      if self.loaded:
        return

      self.loading = True
      started_at = time.perf_counter()
      log_info("ocr.model.load.start", modelId=self.model_id, device=self.device)
      try:
        self._load_model()
        self.loaded = True
        self.last_error = ""
        log_info(
          "ocr.model.load.complete",
          modelId=self.model_id,
          mode=self.mode,
          latencyMs=int((time.perf_counter() - started_at) * 1000)
        )
      except Exception as error:
        self.last_error = str(error)
        log_error("ocr.model.load.failed", modelId=self.model_id, error=str(error))
        raise
      finally:
        self.loading = False

  def extract_document(
    self,
    image_bytes: bytes,
    mime_type: str,
    prompt: str,
    include_layout: bool,
    max_tokens: int
  ) -> dict[str, Any]:
    if mime_type == "application/pdf":
      return {
        "rawText": extract_pdf_text(image_bytes),
        "blocks": [],
        "mode": "pdf-native"
      }

    self.ensure_loaded()
    image_width, image_height = read_image_size(image_bytes)
    resolved_prompt = resolve_prompt(prompt, include_layout)
    token_limit = normalize_token_limit(max_tokens)
    started_at = time.perf_counter()
    log_info("ocr.infer.start", mimeType=mime_type, includeLayout=include_layout, maxTokens=token_limit)

    try:
      raw_output = self._extract_with_infer(
        image_bytes=image_bytes,
        mime_type=mime_type,
        prompt=resolved_prompt,
        max_tokens=token_limit
      )
      raw_text = normalize_model_output(raw_output)
      blocks = parse_grounding_blocks(raw_text, image_width, image_height) if include_layout else []
      log_info(
        "ocr.infer.complete",
        mimeType=mime_type,
        includeLayout=include_layout,
        blockCount=len(blocks),
        latencyMs=int((time.perf_counter() - started_at) * 1000)
      )
      return {
        "rawText": raw_text,
        "blocks": blocks,
        "mode": self.mode
      }
    except Exception as error:
      log_error("ocr.infer.failed", mimeType=mime_type, includeLayout=include_layout, error=str(error))
      raise

  def _load_model(self) -> None:
    from transformers import AutoModel, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(self.model_id, trust_remote_code=True)
    model = load_model_with_memory_fallback(
      AutoModel.from_pretrained,
      self.model_id,
      trust_remote_code=True,
      use_safetensors=True
    )
    model.eval()
    model.to(self.device)

    if not hasattr(model, "infer"):
      raise RuntimeError(f"Model '{self.model_id}' does not expose infer().")

    install_non_cuda_compat(self.device)
    self.model = model
    self.tokenizer = tokenizer
    self.mode = "deepseek-infer"

  def _extract_with_infer(self, image_bytes: bytes, mime_type: str, prompt: str, max_tokens: int) -> str:
    if self.model is None or self.tokenizer is None:
      raise RuntimeError("DeepSeek model is not initialized.")

    suffix = suffix_from_mime(mime_type)
    image_path = ""
    output_dir = ""

    try:
      with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(image_bytes)
        image_path = temp_file.name

      output_dir = tempfile.mkdtemp(prefix="deepseek-ocr-output-")
      original_generate = getattr(self.model, "generate", None)
      with self.lock:
        if callable(original_generate):
          self.model.generate = build_limited_generate(original_generate, max_tokens)  # type: ignore[assignment]

        try:
          response = self.model.infer(
            self.tokenizer,
            prompt=prompt,
            image_file=image_path,
            output_path=output_dir,
            base_size=1024,
            image_size=640,
            crop_mode=True,
            save_results=False,
            test_compress=False,
            eval_mode=True
          )
        finally:
          if callable(original_generate):
            self.model.generate = original_generate  # type: ignore[assignment]

      return normalize_model_output(response)
    finally:
      if image_path and os.path.exists(image_path):
        os.remove(image_path)
      if output_dir and os.path.exists(output_dir):
        shutil.rmtree(output_dir, ignore_errors=True)


def resolve_device() -> str:
  if settings.device in {"cpu", "mps", "cuda"}:
    return settings.device
  if torch.cuda.is_available():
    return "cuda"
  if torch.backends.mps.is_available():
    return "mps"
  return "cpu"


def resolve_torch_dtype() -> torch.dtype:
  if settings.torch_dtype == "float32":
    return torch.float32
  if settings.torch_dtype == "bfloat16":
    return torch.bfloat16
  return torch.float16


def install_non_cuda_compat(target_device: str) -> None:
  global _CUDA_PATCHED
  if _CUDA_PATCHED or torch.cuda.is_available():
    return

  def safe_tensor_cuda(self: torch.Tensor, *args: Any, **kwargs: Any) -> torch.Tensor:
    device_arg = kwargs.get("device") or (args[0] if len(args) > 0 else target_device)
    return self.to(device_arg)

  def safe_module_cuda(self: torch.nn.Module, *args: Any, **kwargs: Any) -> torch.nn.Module:
    device_arg = kwargs.get("device") or (args[0] if len(args) > 0 else target_device)
    return self.to(device_arg)

  torch.Tensor.cuda = safe_tensor_cuda  # type: ignore[assignment]
  torch.nn.Module.cuda = safe_module_cuda  # type: ignore[assignment]
  _CUDA_PATCHED = True


def build_limited_generate(original_generate: Any, max_tokens: int) -> Any:
  limited_tokens = normalize_token_limit(max_tokens)

  def limited_generate(*args: Any, **kwargs: Any) -> Any:
    kwargs["max_new_tokens"] = limited_tokens
    if "no_repeat_ngram_size" in kwargs:
      kwargs["no_repeat_ngram_size"] = min(int(kwargs["no_repeat_ngram_size"]), 20)
    return original_generate(*args, **kwargs)

  return limited_generate


def load_model_with_memory_fallback(loader: Any, model_id: str, **base_kwargs: Any) -> Any:
  attempted_kwargs = [
    {
      **base_kwargs,
      "torch_dtype": resolve_torch_dtype(),
      "low_cpu_mem_usage": True
    },
    {
      **base_kwargs,
      "low_cpu_mem_usage": True
    }
  ]

  seen_signatures: set[str] = set()
  last_error: Exception | None = None
  for kwargs in attempted_kwargs:
    signature = json.dumps(sorted(kwargs.keys()))
    if signature in seen_signatures:
      continue
    seen_signatures.add(signature)
    try:
      return loader(model_id, **kwargs)
    except Exception as error:
      last_error = error

  raise RuntimeError(f"Failed loading model '{model_id}'. Cause: {last_error}")


def suffix_from_mime(mime_type: str) -> str:
  if mime_type == "image/png":
    return ".png"
  if mime_type in {"image/jpeg", "image/jpg", "image/pjpeg"}:
    return ".jpg"
  if mime_type == "application/pdf":
    return ".pdf"
  return ".bin"


def parse_data_url(data_url: str) -> tuple[str, bytes]:
  try:
    header, encoded = data_url.split(",", 1)
  except ValueError as error:
    raise HTTPException(status_code=400, detail="Invalid data URL format.") from error

  if not header.startswith("data:") or ";base64" not in header:
    raise HTTPException(status_code=400, detail="Only base64 data URLs are supported.")

  mime_type = header[5:].split(";")[0].strip() or "application/octet-stream"

  try:
    image_bytes = base64.b64decode(encoded, validate=True)
  except Exception as error:
    raise HTTPException(status_code=400, detail=f"Invalid base64 image payload: {error}") from error

  return mime_type, image_bytes


def read_image_size(image_bytes: bytes) -> tuple[int, int]:
  image = Image.open(io.BytesIO(image_bytes))
  width, height = image.size
  image.close()
  return width, height


def resolve_prompt(prompt: str, include_layout: bool) -> str:
  trimmed = prompt.strip()
  if trimmed:
    return trimmed
  return settings.layout_prompt if include_layout else settings.text_prompt


def normalize_token_limit(value: int) -> int:
  if not isinstance(value, int):
    return max(64, settings.max_new_tokens)
  return max(64, min(4096, value))


def normalize_model_output(response: Any) -> str:
  if isinstance(response, str):
    return response.strip()

  if isinstance(response, dict):
    for key in ("text", "rawText", "raw_text", "result", "output"):
      value = response.get(key)
      if isinstance(value, str) and value.strip():
        return value.strip()
    return json.dumps(response, ensure_ascii=True)

  if isinstance(response, list):
    values = [entry.strip() for entry in response if isinstance(entry, str) and entry.strip()]
    return "\n".join(values).strip()

  return str(response).strip()


def extract_pdf_text(pdf_bytes: bytes) -> str:
  reader = PdfReader(io.BytesIO(pdf_bytes))
  parts: list[str] = []
  for page in reader.pages:
    text = page.extract_text() or ""
    if text.strip():
      parts.append(text.strip())
  return "\n".join(parts).strip()


def parse_grounding_blocks(raw_text: str, image_width: int, image_height: int) -> list[dict[str, Any]]:
  if image_width <= 0 or image_height <= 0:
    return []

  blocks: list[dict[str, Any]] = []
  for match in GROUNDING_BLOCK_PATTERN.finditer(raw_text):
    label = match.group("label").strip()
    coordinates = parse_det_coordinates(match.group("det"))
    block_text = normalize_block_payload(match.group("body")) or label or "text-block"
    for coordinate in coordinates:
      x1, y1, x2, y2 = coordinate
      model_bbox = [x1, y1, x2, y2]
      normalized = [clamp_coordinate(x1), clamp_coordinate(y1), clamp_coordinate(x2), clamp_coordinate(y2)]
      absolute = [
        int(round(normalized[0] / 999 * image_width)),
        int(round(normalized[1] / 999 * image_height)),
        int(round(normalized[2] / 999 * image_width)),
        int(round(normalized[3] / 999 * image_height))
      ]
      if absolute[2] <= absolute[0] or absolute[3] <= absolute[1]:
        continue

      block: dict[str, Any] = {
        "text": block_text,
        "page": 1,
        "bbox": absolute,
        "bboxNormalized": normalized,
        "bboxModel": model_bbox
      }
      block["blockType"] = classify_block_type(label)
      blocks.append(block)
  return blocks


def parse_det_coordinates(raw_coordinates: str) -> list[list[float]]:
  try:
    parsed = ast.literal_eval(raw_coordinates)
  except Exception:
    return []
  if not isinstance(parsed, list):
    return []

  output: list[list[float]] = []
  for entry in parsed:
    if not isinstance(entry, list) or len(entry) != 4:
      continue
    try:
      output.append([float(entry[0]), float(entry[1]), float(entry[2]), float(entry[3])])
    except (TypeError, ValueError):
      continue
  return output


def clamp_coordinate(value: float) -> float:
  if value < 0:
    return 0.0
  if value > 999:
    return 999.0
  return value


def classify_block_type(label: str) -> str:
  normalized = label.strip().lower()
  if "title" in normalized:
    return "title"
  if "table" in normalized:
    return "table"
  if "image" in normalized:
    return "image"
  if "line" in normalized:
    return "line"
  return "text"


def normalize_block_payload(value: str) -> str:
  text = value.strip()
  if not text:
    return ""

  text = re.sub(r"</?(table|thead|tbody|tr)>", "\n", text, flags=re.IGNORECASE)
  text = re.sub(r"</?td>", " | ", text, flags=re.IGNORECASE)
  text = re.sub(r"<[^>]+>", " ", text)
  text = text.replace("**", " ").replace("__", " ")
  text = re.sub(r"^[#>\-\s]+", "", text)
  text = re.sub(r"\s+", " ", text)
  return text.strip()


def estimate_confidence(text: str, blocks: list[dict[str, Any]]) -> float:
  if not text.strip():
    return 0.0

  length_score = min(1.0, len(text) / 1200)
  ascii_score = sum(1 for char in text if 31 < ord(char) < 127) / max(1, len(text))
  block_score = min(1.0, len(blocks) / 24)
  confidence = 0.45 + (0.25 * length_score) + (0.20 * ascii_score) + (0.10 * block_score)
  return max(0.0, min(0.99, round(confidence, 4)))
