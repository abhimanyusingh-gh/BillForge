from __future__ import annotations

import subprocess
from pathlib import Path
from threading import Lock
from typing import Any

from ..boundary import LLMProvider
from ..logging import log_error, log_info
from ..settings import settings
from .local_codex_cli import build_codex_prompt
from .local_mlx import parse_json_object, recover_payload_from_candidates, recover_payload_from_text, sanitize_payload_for_prompt


class LocalClaudeCliLLMProvider(LLMProvider):
  def __init__(self) -> None:
    self.generation_lock = Lock()
    self.last_error = ""
    self.root_dir = Path(__file__).resolve().parents[3]

  def startup(self) -> None:
    return

  def health(self) -> dict[str, Any]:
    payload: dict[str, Any] = {
      "status": "ok",
      "modelId": self._effective_model_id(),
      "modelLoaded": True,
      "modelLoading": False,
      "lastError": self.last_error,
      "provider": "local_claude_cli"
    }
    try:
      subprocess.run(
        [settings.claude_command, "--version"],
        cwd=self._resolve_workdir(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
        timeout=max(3, settings.claude_timeout_ms // 1000)
      )
    except Exception as error:
      payload["status"] = "error"
      payload["lastError"] = str(error)
      self.last_error = str(error)
    return payload

  def select_fields(self, payload: dict[str, Any]) -> dict[str, Any]:
    if payload.get("llmAssist"):
      log_info("slm.llm_assist.local_claude_cli_text_only", note="Claude CLI provider runs text-only verification against OCR payload")

    with self.generation_lock:
      for strict in (False, True):
        prompt = build_codex_prompt(payload, strict=strict)
        try:
          output_text = self._run_claude(prompt)
        except Exception as error:
          self.last_error = str(error)
          log_error("slm.claude_cli.exec.failed", error=str(error))
          break

        usage = {"promptTokens": None, "completionTokens": None}
        log_info(
          "slm.raw_output",
          output_length=len(output_text),
          completion_tokens=0,
          first_200=output_text[:200],
          last_200=output_text[-200:] if len(output_text) > 200 else ""
        )
        parsed = parse_json_object(output_text)
        if parsed is not None:
          parsed["_usage"] = usage
          return parsed
        recovered = recover_payload_from_text(output_text, payload)
        if recovered is not None:
          recovered["_usage"] = usage
          return recovered

    fallback = recover_payload_from_candidates(payload)
    if fallback is not None:
      return fallback

    return {
      "selected": {},
      "reasonCodes": {},
      "issues": ["slm_output_invalid_json"]
    }

  def _run_claude(self, prompt: str) -> str:
    cmd = [
      settings.claude_command,
      "--print",
      "--output-format", "text",
      "--model", settings.claude_model or "sonnet",
    ]
    if settings.claude_max_tokens:
      cmd.extend(["--max-tokens", str(settings.claude_max_tokens)])
    cmd.extend(["-p", prompt])

    completed = subprocess.run(
      cmd,
      text=True,
      capture_output=True,
      cwd=self._resolve_workdir(),
      timeout=max(60, settings.claude_timeout_ms // 1000),
      check=False
    )
    if completed.returncode != 0:
      raise RuntimeError(f"claude exited {completed.returncode}: {completed.stderr.strip()}")
    return completed.stdout.strip()

  def _resolve_workdir(self) -> Path:
    configured = settings.claude_workdir.strip()
    return Path(configured).expanduser() if configured else self.root_dir

  def _effective_model_id(self) -> str:
    configured = settings.claude_model.strip()
    if configured:
      return configured
    return "claude-cli/sonnet"
