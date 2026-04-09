from __future__ import annotations

import ast
import json
import re
from typing import Any

from ..settings import settings


def sanitize_payload_for_prompt(payload: dict[str, Any]) -> dict[str, Any]:
  if not isinstance(payload, dict):
    return {}

  hints = payload.get("hints") if isinstance(payload.get("hints"), dict) else {}

  def pick(name: str, *, expected_type: type[Any] | None = None, default: Any = None) -> Any:
    value = payload.get(name, hints.get(name, default))
    if expected_type is not None and not isinstance(value, expected_type):
      return default
    return value

  compact_blocks: list[dict[str, Any]] = []
  raw_blocks = payload.get("ocrBlocks")
  if isinstance(raw_blocks, list):
    for index, entry in enumerate(raw_blocks[: settings.max_blocks]):
      if not isinstance(entry, dict):
        continue
      compact_blocks.append(
        {
          "index": index,
          "text": entry.get("text"),
          "page": entry.get("page"),
          "bboxNormalized": entry.get("bboxNormalized") or entry.get("bboxModel") or entry.get("bbox")
        }
      )

  compact_page_images: list[dict[str, Any]] = []
  raw_page_images = pick("pageImages", expected_type=list, default=[])
  if isinstance(raw_page_images, list):
    for entry in raw_page_images[:3]:
      if not isinstance(entry, dict):
        continue
      data_url = entry.get("dataUrl")
      if not isinstance(data_url, str) or not data_url.strip():
        continue
      compact_page_images.append(
        {
          "page": entry.get("page"),
          "mimeType": entry.get("mimeType"),
          "width": entry.get("width"),
          "height": entry.get("height"),
          "dpi": entry.get("dpi"),
          "dataUrl": data_url
        }
      )

  compact: dict[str, Any] = {
    "parsed": payload.get("parsed") if isinstance(payload.get("parsed"), dict) else {},
    "ocrText": payload.get("ocrText") if isinstance(payload.get("ocrText"), str) else "",
    "ocrBlocks": compact_blocks,
    "mode": payload.get("mode"),
  }
  if compact_page_images:
    compact["pageImages"] = compact_page_images

  compact["hints"] = {
    "documentLanguage": pick("documentLanguage"),
    "languageHint": pick("languageHint"),
    "vendorTemplateMatched": pick("vendorTemplateMatched"),
    "fieldCandidates": pick("fieldCandidates", expected_type=dict, default={}),
    "priorCorrections": pick("priorCorrections", expected_type=list, default=[]),
    "glCategories": pick("glCategories", expected_type=list, default=[])
  }
  return compact


def parse_json_object(text: str) -> dict[str, Any] | None:
  candidate = text.strip()
  if not candidate:
    return None

  fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", candidate, re.DOTALL)
  if fence_match:
    parsed = try_parse_json(fence_match.group(1).strip())
    if parsed is not None:
      return normalize_keys(parsed)

  parsed = try_parse_json(candidate)
  if parsed is not None:
    return normalize_keys(parsed)

  best: dict[str, Any] | None = None
  for match in re.finditer(r"\{", candidate):
    start = match.start()
    depth = 0
    end = start
    for i in range(start, len(candidate)):
      if candidate[i] == "{":
        depth += 1
      elif candidate[i] == "}":
        depth -= 1
        if depth == 0:
          end = i + 1
          break
    if end > start:
      parsed = try_parse_json(candidate[start:end].strip())
      if parsed is not None:
        result = normalize_keys(parsed)
        if "selected" in result or "invoiceNumber" in result or "vendorName" in result:
          return result
        if best is None:
          best = result

  return best


def normalize_keys(obj: dict[str, Any]) -> dict[str, Any]:
  KEY_MAP = {
    "invoicenumber": "invoiceNumber",
    "vendorname": "vendorName",
    "totalamountminor": "totalAmountMinor",
    "invoicedate": "invoiceDate",
    "duedate": "dueDate",
    "invoicetype": "invoiceType",
    "reasoncodes": "reasonCodes",
  }
  result: dict[str, Any] = {}
  for key, value in obj.items():
    normalized_key = KEY_MAP.get(key.lower(), key)
    if isinstance(value, dict):
      result[normalized_key] = normalize_keys(value)
    else:
      result[normalized_key] = value
  return result


def try_parse_json(text: str) -> dict[str, Any] | None:
  if not text:
    return None

  try:
    parsed = json.loads(text)
  except Exception:
    try:
      literal_parsed = ast.literal_eval(text)
    except Exception:
      return None
    return literal_parsed if isinstance(literal_parsed, dict) else None
  return parsed if isinstance(parsed, dict) else None


def recover_payload_from_text(text: str, payload: dict[str, Any]) -> dict[str, Any] | None:
  normalized = " ".join(text.strip().split())
  if not normalized:
    return None

  selected: dict[str, Any] = {}
  reason_codes: dict[str, str] = {}
  hints = payload.get("hints") if isinstance(payload.get("hints"), dict) else {}
  field_candidates = hints.get("fieldCandidates")
  if isinstance(field_candidates, dict):
    for field in ("invoiceNumber", "vendorName", "currency", "totalAmountMinor", "invoiceDate", "dueDate"):
      raw_candidates = field_candidates.get(field)
      if not isinstance(raw_candidates, list):
        continue

      match = select_candidate_in_text(field, [str(entry) for entry in raw_candidates], normalized)
      if match is None:
        continue
      selected[field] = match
      reason_codes[field] = "slm_text_recovered"

  if not selected:
    return None

  return {
    "selected": selected,
    "reasonCodes": reason_codes,
    "issues": []
  }


def recover_payload_from_candidates(payload: dict[str, Any]) -> dict[str, Any] | None:
  hints = payload.get("hints") if isinstance(payload.get("hints"), dict) else {}
  raw_candidates = hints.get("fieldCandidates")
  if not isinstance(raw_candidates, dict):
    return None

  selected: dict[str, Any] = {}
  reason_codes: dict[str, str] = {}
  ordered_fields = ("invoiceNumber", "vendorName", "currency", "totalAmountMinor", "invoiceDate", "dueDate")
  for field in ordered_fields:
    value = pick_first_candidate(field, raw_candidates.get(field))
    if value is None:
      continue
    selected[field] = value
    reason_codes[field] = "slm_candidate_fallback"

  if not selected:
    return None

  return {
    "selected": selected,
    "reasonCodes": reason_codes,
    "issues": []
  }


def select_candidate_in_text(field: str, candidates: list[str], normalized_text: str) -> Any:
  cleaned = [entry.strip() for entry in candidates if entry.strip()]
  if not cleaned:
    return None

  if field == "totalAmountMinor":
    for candidate in cleaned:
      if candidate.isdigit() and re.search(rf"(?<!\d){re.escape(candidate)}(?!\d)", normalized_text):
        return int(candidate)
    return None

  if field == "currency":
    upper_text = normalized_text.upper()
    for candidate in cleaned:
      upper_candidate = candidate.upper()
      if re.search(rf"\b{re.escape(upper_candidate)}\b", upper_text):
        return upper_candidate
    return None

  lowered = normalized_text.lower()
  for candidate in cleaned:
    if candidate.lower() in lowered:
      return candidate
  return None


def pick_first_candidate(field: str, value: Any) -> Any:
  if not isinstance(value, list):
    return None

  candidates = [str(entry).strip() for entry in value if str(entry).strip()]
  if not candidates:
    return None

  if field == "totalAmountMinor":
    for candidate in candidates:
      if candidate.isdigit():
        return int(candidate)
    return None

  if field == "currency":
    return candidates[0].upper()

  return candidates[0]


_DEFAULT_GL_CATEGORIES = [
  "Office Expenses", "Professional Services", "Rent", "Utilities", "Travel",
  "Contractor Services", "Raw Materials", "Commission", "Insurance",
  "Repairs & Maintenance", "Software Subscription", "Other"
]


def build_extraction_prompt(payload: dict[str, Any], strict: bool) -> str:
  hints = payload.get("hints") if isinstance(payload.get("hints"), dict) else {}
  prior_corrections = hints.get("priorCorrections")
  prior_corrections_text = ""
  if isinstance(prior_corrections, list) and prior_corrections:
    parts = []
    for entry in prior_corrections[:6]:
      if isinstance(entry, dict) and isinstance(entry.get("field"), str) and isinstance(entry.get("hint"), str):
        parts.append(f"{entry['field']}: {entry['hint']}")
    if parts:
      prior_corrections_text = "PRIOR_CORRECTIONS:\n- " + "\n- ".join(parts) + "\n"

  instruction = (
    "You are an OCR post-processing system.\n"
    "INPUT\n"
    "rawText\n"
    "blocks[]:\n"
    "text\n"
    "page\n"
    "blockIndex\n"
    "bboxNormalized [x1,y1,x2,y2]\n"
    "pageImages[] when present:\n"
    "page\n"
    "mimeType\n"
    "width\n"
    "height\n"
    "dpi\n"
    "dataUrl\n"
    "TASK\n"
    "Extract invoice data strictly from OCR evidence.\n"
    "Return JSON only.\n"
    "OUTPUT SCHEMA\n"
    "{\n"
    '  "file": "<filename>",\n'
    '  "lineItemCount": <int>,\n'
    '  "invoiceNumber": { "value": "<string>", "provenance": {...} },\n'
    '  "vendorNameContains": { "value": "<string>", "provenance": {...} },\n'
    '  "invoiceDate": { "value": "YYYY-MM-DD", "provenance": {...} },\n'
    '  "dueDate": { "value": "YYYY-MM-DD", "provenance": {...} },\n'
    '  "currency": { "value": "<ISO>", "provenance": {...} },\n'
    '  "totalAmountMinor": { "value": <int>, "provenance": {...} },\n'
    '  "lineItems": [\n'
    "    {\n"
    '      "description": "<string>",\n'
    '      "amountMinor": <int>,\n'
    '      "provenance": {...}\n'
    "    }\n"
    "  ],\n"
    '  "gst": {\n'
    '    "cgstMinor": { "value": <int>, "provenance": {...} },\n'
    '    "sgstMinor": { "value": <int>, "provenance": {...} },\n'
    '    "subtotalMinor": { "value": <int>, "provenance": {...} },\n'
    '    "totalTaxMinor": { "value": <int>, "provenance": {...} }\n'
    "  },\n"
    '  "classification": {\n'
    '    "glCategory": "<string>",\n'
    '    "invoiceType": "<string>"\n'
    "  }\n"
    "}\n"
    "\n"
    "HARD RULES\n"
    "JSON only\n"
    "No nulls\n"
    "Omit uncertain fields\n"
    "Every value must have provenance\n"
    "Never guess or infer\n"
    "glCategory must be one of: " + ", ".join(
      [c for c in hints.get("glCategories", []) if isinstance(c, str) and c.strip()] or _DEFAULT_GL_CATEGORIES
    ) + "\n"
    "invoiceType must be one of: purchase, service, expense, rent\n"
    "\n"
    "DECISION RULE\n"
    "Include a field only if it is clearly present in OCR, correctly labeled or structurally obvious, and has no conflicting values.\n"
    "Else omit it.\n"
    "\n"
    "NORMALIZATION\n"
    "Dates to YYYY-MM-DD\n"
    "Amounts to integer minor units\n"
    "Currency to ISO code using symbols such as ₹ to INR and $ to USD\n"
    "If no explicit currency symbol or code is present, default currency to INR\n"
    "\n"
    "PROVENANCE\n"
    "Use the value block only, not the label block\n"
    'Single block: { "page": int, "blockIndex": int, "bboxNormalized": [...] }\n'
    'Multi-block only if required: { "blockIndices": [...], "bboxNormalized": merged }\n'
    "\n"
    "FIELD RULES\n"
    "invoiceNumber must be labeled Invoice and must reject PO, Ref, and Order numbers\n"
    "vendorNameContains must be the top or header seller only and never Bill To\n"
    "invoiceDate and dueDate must be explicitly labeled with no derivation\n"
    "totalAmountMinor priority order:\n"
    "1. Total or Grand Total\n"
    "2. Final payable\n"
    "3. Total in words only if exact\n"
    "4. Fallback compute only if subtotal and all taxes exist and there is no conflicting total\n"
    "Reject balance due if different and reject paid amount\n"
    "\n"
    "GST RULES\n"
    "Only include GST when explicit\n"
    "cgstMinor and sgstMinor must be explicit\n"
    "subtotalMinor must be pre-tax\n"
    "totalTaxMinor may be explicit or cgst plus sgst only if both exist\n"
    "\n"
    "LINE ITEMS\n"
    "Include line items only if confident\n"
    "lineItemCount must equal the number of returned lineItems when lineItems are present\n"
    "If no confident line items are returned, set lineItemCount to 0\n"
    "Each item must have amountMinor and provenance\n"
    "Use the final row amount column\n"
    "Exclude unit price, tax columns, totals, subtotals, and duplicates\n"
    "One row equals one item\n"
    "\n"
    "TABLE PRIORITY\n"
    "Use Amount, Line Total, or Net columns\n"
    "Never use CGST or SGST columns or summary rows for line items\n"
    "\n"
    "OCR POLICY\n"
    "Minor formatting noise is allowed\n"
    "Digit guessing and conflict resolution are not allowed\n"
    "\n"
    "OUTPUT RULES\n"
    "No empty arrays or empty objects\n"
    "Omit missing sections entirely\n"
    "Prefer omission over wrong extraction\n"
    "\n"
    "EXTRACTION ORDER\n"
    "Header\n"
    "Totals\n"
    "GST\n"
    "Line items\n"
    "\n"
    "FINAL RULE\n"
    "If unsure, omit.\n"
    + ("Final check: output must be valid JSON and match the schema exactly.\n" if strict else "")
    + "\n"
    + (prior_corrections_text if prior_corrections_text else "")
    + "INPUT_JSON:\n"
  )

  prompt_payload = sanitize_payload_for_prompt(payload)
  return (
    f"{instruction}\nINPUT_JSON:{json.dumps(prompt_payload, ensure_ascii=True, separators=(',', ':'))}\nOUTPUT_JSON:"
  )
