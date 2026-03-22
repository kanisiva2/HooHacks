"""
LLM client — abstraction over Anthropic, OpenAI, and Gemini.
Routes to the configured provider based on LLM_PROVIDER config.
All calls are async. JSON responses are sanitized (markdown fences stripped).
"""

import json
import logging
import re
import time
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?```$", re.DOTALL)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _call_llm(system: str, user: str, max_tokens: int = 1024) -> str:
    """Route a single prompt to the configured LLM provider and return raw text."""
    provider = settings.llm_provider
    tokens_info: str | None = None
    _t0 = time.perf_counter()

    try:
        if provider == "gemini":
            from google import genai

            client = genai.Client(api_key=settings.gemini_api_key)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=f"{system}\n\n{user}",
                config=genai.types.GenerateContentConfig(max_output_tokens=max_tokens),
            )
            usage = getattr(response, "usage_metadata", None)
            if usage:
                tokens_info = f"in={getattr(usage, 'prompt_token_count', '?')} out={getattr(usage, 'candidates_token_count', '?')}"
            return response.text or ""

        if provider == "anthropic":
            import anthropic

            client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            usage = getattr(message, "usage", None)
            if usage:
                tokens_info = f"in={usage.input_tokens} out={usage.output_tokens}"
            return message.content[0].text

        import openai

        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o",
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        usage = getattr(response, "usage", None)
        if usage:
            tokens_info = f"in={usage.prompt_tokens} out={usage.completion_tokens}"
        return response.choices[0].message.content or ""

    finally:
        latency_ms = (time.perf_counter() - _t0) * 1000
        logger.info(
            "llm_call provider=%s latency_ms=%.0f tokens=%s",
            provider, latency_ms, tokens_info or "unknown",
        )


def _parse_json_response(text: str) -> Any:
    """Strip optional markdown code fences then parse JSON."""
    cleaned = text.strip()
    match = _FENCE_RE.match(cleaned)
    if match:
        cleaned = match.group(1).strip()
    return json.loads(cleaned)


# ---------------------------------------------------------------------------
# Domain functions
# ---------------------------------------------------------------------------

async def extract_tasks_from_chunk(text: str, speaker: str) -> list[dict]:
    """Extract action-item proposals from a transcript chunk.

    Returns a list of dicts:
        [{"task": str, "owner": str|null, "priority": str|null, "confidence": float}]
    """
    system = (
        "You are an incident-management assistant. Extract action items from the "
        "transcript chunk. Return ONLY a JSON array. Each element must have keys: "
        '"task" (string), "owner" (string or null), "priority" ("P1"|"P2"|"P3"|"P4" or null), '
        '"confidence" (float 0-1). If there are no action items, return [].'
    )
    user = f"Speaker: {speaker}\nTranscript:\n{text}"
    try:
        raw = await _call_llm(system, user)
        result = _parse_json_response(raw)
        return result if isinstance(result, list) else []
    except Exception:
        logger.exception("extract_tasks_from_chunk failed")
        return []


async def detect_reassignment(
    text: str, active_tasks: list[dict]
) -> dict | None:
    """Detect if a transcript chunk reassigns an existing task.

    Returns {"task_id": str, "new_owner": str} or None.
    """
    if not active_tasks:
        return None

    tasks_summary = json.dumps(active_tasks, default=str)
    system = (
        "You are an incident-management assistant. Determine if the transcript "
        "reassigns any of the currently active tasks. If yes, return a JSON object "
        '{"task_id": "<id>", "new_owner": "<name>"}. If no reassignment, return null.'
    )
    user = f"Active tasks:\n{tasks_summary}\n\nTranscript:\n{text}"
    try:
        raw = await _call_llm(system, user)
        result = _parse_json_response(raw)
        if isinstance(result, dict) and "task_id" in result:
            return result
        return None
    except Exception:
        logger.exception("detect_reassignment failed")
        return None


async def rank_suspect_files(
    transcript_summary: str,
    file_tree: list[str],
    recent_commits: list[dict],
    top_n: int = 5,
) -> list[dict]:
    """Rank repository files by likelihood of being related to the incident.

    Returns a list of dicts:
        [{"file": str, "confidence": float, "reason": str}]
    """
    commits_text = "\n".join(
        f"- {c.get('sha', '')[:8]} {c.get('message', '')}" for c in recent_commits
    )
    tree_text = "\n".join(file_tree[:500])

    system = (
        "You are a senior SRE investigating a production incident. Given the incident "
        "transcript summary, the repository file tree, and recent commits, rank the top "
        f"{top_n} most likely suspect files. Return ONLY a JSON array of objects with "
        '"file" (string path), "confidence" (float 0-1), "reason" (string explanation).'
    )
    user = (
        f"Incident summary:\n{transcript_summary}\n\n"
        f"Recent commits:\n{commits_text}\n\n"
        f"File tree (truncated):\n{tree_text}"
    )
    try:
        raw = await _call_llm(system, user, max_tokens=2048)
        result = _parse_json_response(raw)
        return result if isinstance(result, list) else []
    except Exception:
        logger.exception("rank_suspect_files failed")
        return []


async def identify_suspect_lines(
    file_content: str, incident_context: str, commit_context: str
) -> dict | None:
    """Identify the suspect line range in a source file.

    Returns {"start": int, "end": int, "explanation": str} or None.
    """
    system = (
        "You are a senior SRE. Given a source file and incident context, identify the "
        "most likely suspect line range. Return a JSON object with keys: "
        '"start" (int line number), "end" (int line number), "explanation" (string). '
        "If no suspect range can be identified, return null."
    )
    user = (
        f"Incident context:\n{incident_context}\n\n"
        f"Commit context:\n{commit_context}\n\n"
        f"File content:\n{file_content[:8000]}"
    )
    try:
        raw = await _call_llm(system, user, max_tokens=1024)
        stripped = raw.strip().lower() if raw else ""
        if not stripped or stripped == "null" or stripped == "none":
            logger.info("identify_suspect_lines: LLM returned no suspect range")
            return None
        result = _parse_json_response(raw)
        if isinstance(result, dict) and "start" in result:
            return result
        return None
    except Exception:
        logger.exception("identify_suspect_lines failed (raw response: %s)", raw[:200] if raw else "<empty>")
        return None


async def generate_spoken_answer(
    question: str,
    incident_summary: str,
    deep_dive_results: list[dict],
    active_tasks: list[dict],
) -> str:
    """Generate a concise 1-2 sentence spoken answer to a meeting question."""
    dd_text = json.dumps(deep_dive_results[:3], default=str) if deep_dive_results else "None yet"
    tasks_text = json.dumps(active_tasks[:5], default=str) if active_tasks else "None yet"

    system = (
        "You are Sprynt, an AI incident operator on a live outage call. Answer the "
        "question concisely in 1-2 sentences. Be confident and evidence-backed. "
        "Do not ramble."
    )
    user = (
        f"Question: {question}\n\n"
        f"Incident summary:\n{incident_summary}\n\n"
        f"Deep dive findings:\n{dd_text}\n\n"
        f"Active tasks:\n{tasks_text}"
    )
    try:
        return await _call_llm(system, user, max_tokens=256)
    except Exception:
        logger.exception("generate_spoken_answer failed")
        return "I'm having trouble generating an answer right now."
