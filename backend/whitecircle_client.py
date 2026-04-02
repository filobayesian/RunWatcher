"""WhiteCircle AI safety client."""
import os
import json
import logging
import urllib.request
import urllib.error
import ssl
from typing import Optional

logger = logging.getLogger("runwatcher.whitecircle")

_ctx = ssl.create_default_context()
_BASE_URL = "https://eu.whitecircle.ai"
_CHECK_PATH = "/api/session/check"
_VERSION_HEADER = "2025-12-01"


def check_content(
    messages: list[dict],
    api_key: Optional[str] = None,
    deployment_id: Optional[str] = None,
) -> dict:
    """Call WhiteCircle Protect API and return the raw safety check result."""
    api_key = api_key or os.getenv("WHITECIRCLE_API_KEY")
    deployment_id = deployment_id or os.getenv("WHITECIRCLE_DEPLOYMENT_ID")

    if not api_key or not deployment_id:
        raise ValueError("Missing WHITECIRCLE_API_KEY or WHITECIRCLE_DEPLOYMENT_ID")

    payload = {"deployment_id": deployment_id, "messages": messages}
    data = json.dumps(payload).encode()

    req = urllib.request.Request(
        f"{_BASE_URL}{_CHECK_PATH}", data=data, method="POST"
    )
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("whitecircle-version", _VERSION_HEADER)

    with urllib.request.urlopen(req, timeout=8, context=_ctx) as resp:
        return json.loads(resp.read())


def check_run_summary(run_name: str, status: str, issues: list[dict]) -> dict:
    """Quick safety check using just the run summary (for list view badges)."""
    issues_text = ", ".join(i["type"] for i in issues) if issues else "none"
    messages = [
        {"role": "user", "content": f"Analyze training run: {run_name}"},
        {
            "role": "assistant",
            "content": (
                f"ML training run '{run_name}' analysis complete. "
                f"Status: {status}. Issues detected: {issues_text}."
            ),
        },
    ]
    return check_content(messages)


def check_diagnosis(run_name: str, diagnosis_text: str) -> dict:
    """Safety check on a full Claude diagnosis (for detail panel)."""
    messages = [
        {"role": "user", "content": f"Diagnose ML training run: {run_name}"},
        {"role": "assistant", "content": diagnosis_text},
    ]
    return check_content(messages)


def format_safety_result(result: dict) -> dict:
    """Format a raw WhiteCircle result into a clean API-friendly structure."""
    policies = result.get("policies", {})
    return {
        "flagged": result.get("flagged", False),
        "session_id": result.get("internal_session_id"),
        "flagged_policies": [
            {
                "id": pid,
                "name": p["name"],
                "flagged_source": p.get("flagged_source", []),
            }
            for pid, p in policies.items()
            if p.get("flagged")
        ],
        "all_policies": [
            {"id": pid, "name": p["name"], "flagged": p.get("flagged", False)}
            for pid, p in policies.items()
        ],
    }
