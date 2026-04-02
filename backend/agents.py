"""
LLM-powered analysis agents for RunWatcher.
Uses OpenRouter to access Claude for monitor diagnosis and scientist recommendations.
"""

import os
import json
from pathlib import Path

from openai import OpenAI


MODEL = "anthropic/claude-sonnet-4"

MONITOR_SYSTEM_PROMPT = """You are RunWatcher, an expert ML experiment monitoring agent specializing in RL finetuning of LLMs. You analyze experiment runs and provide clear, actionable diagnoses.

The experiment: LoRA finetuning of Gemma 9B to generate happy one-liners from movie summaries using GRPO (Group Relative Policy Optimization). The reward function combines faithfulness, readability, semantic similarity to "happiness", and length penalties.

Key metrics to watch:
- train/reward_mean: overall reward (higher = model learns better)
- train/mean_f_score: faithfulness score (how well the output reflects the movie summary)
- train/kl_divergence: KL between policy and reference model (too low = stopped exploring)
- train/reward_std: diversity of rewards across the group (too low = mode collapse)
- train/gradient_norm: magnitude of gradients (too low = nothing being learned)

When providing a diagnosis, include:
1. A 2-3 sentence diagnosis of what happened in this run
2. Severity assessment (healthy / warning / critical)
3. What the researcher should check or try next"""

SCIENTIST_SYSTEM_PROMPT = """You are a research scientist agent. Given a diagnosis of a problematic training run and the current training config, propose specific, actionable changes to fix the issue.

You specialize in RL finetuning of LLMs, particularly GRPO (Group Relative Policy Optimization) with LoRA adapters on Gemma models.

Your response should include:
1. Proposed config changes shown as before/after YAML snippets
2. A clear rationale explaining why each change should help
3. A verification test: a simple check the researcher should run to confirm the fix works

Be specific with numbers. Don't just say "increase learning rate" — say what to change it to and why."""


def _get_client() -> OpenAI | None:
    """Create an OpenRouter client via the OpenAI SDK. Returns None if API key is not set."""
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key or api_key == "your-openrouter-api-key-here":
        return None
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )


def _placeholder_response(context: str) -> str:
    """Return a placeholder when the API key is not configured."""
    return (
        f"[RunWatcher AI analysis unavailable — OPENROUTER_API_KEY not configured]\n\n"
        f"Context provided:\n{context}\n\n"
        f"To enable AI-powered analysis, set your OPENROUTER_API_KEY in the .env file."
    )


def monitor_diagnosis(
    run_data: dict,
    heuristic_results: dict,
    history_summary: dict,
) -> str:
    """
    Generate an LLM-powered diagnosis for a training run.

    Args:
        run_data: Run summary dict from wandb_client.get_all_runs()
        heuristic_results: Output from heuristics.classify_run()
        history_summary: Compact history summary from wandb_client.get_history_summary()

    Returns:
        Diagnosis text, or a placeholder if API key is missing.
    """
    # Build the user message with all context
    alerts_text = ""
    if heuristic_results.get("issues"):
        alerts_text = "\n".join(
            f"  - [{issue['severity'].upper()}] {issue['type']}: {issue['detail']}"
            for issue in heuristic_results["issues"]
        )
    else:
        alerts_text = "  No heuristic alerts triggered."

    # Format metrics summary
    stats_text = ""
    if history_summary.get("stats"):
        for metric, stats in history_summary["stats"].items():
            stats_text += (
                f"  {metric}: first={stats.get('first', 'N/A'):.4f}, "
                f"last={stats.get('last', 'N/A'):.4f}, "
                f"min={stats.get('min', 'N/A'):.4f}, "
                f"max={stats.get('max', 'N/A'):.4f}, "
                f"mean={stats.get('mean', 'N/A'):.4f} "
                f"({stats.get('count', 0)} data points)\n"
            )
    else:
        stats_text = "  No metric statistics available."

    # Format first/last rows
    first_rows = json.dumps(history_summary.get("first_5", []), indent=2, default=str)
    last_rows = json.dumps(history_summary.get("last_5", []), indent=2, default=str)

    config_text = json.dumps(run_data.get("config_summary", {}), indent=2, default=str)

    user_message = f"""Analyze this training run:

Run Name: {run_data.get('name', 'unknown')}
Run State: {run_data.get('state', 'unknown')}
Runtime: {run_data.get('runtime_seconds', 'N/A')} seconds

Config Summary:
{config_text}

Heuristic Alerts:
{alerts_text}

Overall Heuristic Status: {heuristic_results.get('status', 'unknown')}

Metric Statistics:
{stats_text}

First 5 logged steps:
{first_rows}

Last 5 logged steps:
{last_rows}

Total logged steps: {history_summary.get('total_rows', 0)}

Please provide:
1. A 2-3 sentence diagnosis
2. Severity assessment
3. What the researcher should check or try next"""

    client = _get_client()
    if client is None:
        return _placeholder_response(user_message)

    try:
        response = client.chat.completions.create(
            model=MODEL,
            max_tokens=1024,
            messages=[
                {"role": "system", "content": MONITOR_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"[RunWatcher AI error: {e}]\n\nFallback context:\n{user_message}"


def scientist_recommendation(diagnosis: str, run_config: dict) -> dict:
    """
    Generate scientist-level recommendations for fixing a problematic run.

    Args:
        diagnosis: The monitor diagnosis text.
        run_config: The full training config dict (from training_config.yaml).

    Returns:
        Dict with keys: proposed_changes, rationale, verification_test, raw_response
    """
    import yaml

    config_yaml = yaml.dump(run_config, default_flow_style=False, sort_keys=False)

    user_message = f"""Here is the diagnosis of a problematic training run:

--- DIAGNOSIS ---
{diagnosis}
--- END DIAGNOSIS ---

Here is the current training configuration (YAML):

```yaml
{config_yaml}
```

Based on this diagnosis, please provide:
1. Proposed config changes as before/after YAML snippets
2. A clear rationale for each change
3. A verification test the researcher should run to confirm the fix works"""

    client = _get_client()
    if client is None:
        placeholder = _placeholder_response(user_message)
        return {
            "proposed_changes": placeholder,
            "rationale": "AI analysis unavailable.",
            "verification_test": "Set OPENROUTER_API_KEY to enable.",
            "raw_response": placeholder,
        }

    try:
        response = client.chat.completions.create(
            model=MODEL,
            max_tokens=2048,
            messages=[
                {"role": "system", "content": SCIENTIST_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )
        raw_text = response.choices[0].message.content

        # Try to parse structured sections from the response
        result = _parse_scientist_response(raw_text)
        result["raw_response"] = raw_text
        return result

    except Exception as e:
        error_text = f"[RunWatcher AI error: {e}]"
        return {
            "proposed_changes": error_text,
            "rationale": error_text,
            "verification_test": error_text,
            "raw_response": error_text,
        }


def _parse_scientist_response(text: str) -> dict:
    """
    Best-effort parse of the scientist response into structured sections.
    Falls back to the full text for each field if parsing fails.
    """
    result = {
        "proposed_changes": text,
        "rationale": text,
        "verification_test": text,
    }

    lower = text.lower()

    # Look for proposed changes section
    for marker in ["proposed config changes", "before/after", "yaml changes", "config changes"]:
        idx = lower.find(marker)
        if idx != -1:
            next_section = _find_next_section(text, idx + len(marker))
            result["proposed_changes"] = text[idx:next_section].strip()
            break

    # Look for rationale section
    for marker in ["rationale", "explanation", "why these changes"]:
        idx = lower.find(marker)
        if idx != -1:
            next_section = _find_next_section(text, idx + len(marker))
            result["rationale"] = text[idx:next_section].strip()
            break

    # Look for verification section
    for marker in ["verification test", "verification", "how to verify", "test"]:
        idx = lower.find(marker)
        if idx != -1:
            result["verification_test"] = text[idx:].strip()
            break

    return result


def _find_next_section(text: str, start: int) -> int:
    """Find the start of the next major section in the text."""
    import re

    remaining = text[start:]
    patterns = [
        r'\n\d+\.\s+\*?\*?[A-Z]',      # Numbered section
        r'\n#{1,3}\s',                    # Markdown header
        r'\n\*\*[A-Z]',                  # Bold section header
    ]

    earliest = len(text)
    for pattern in patterns:
        match = re.search(pattern, remaining)
        if match:
            candidate = start + match.start()
            if candidate < earliest:
                earliest = candidate

    return earliest


def load_training_config() -> dict:
    """Load the training config YAML from the project root."""
    config_path = Path(__file__).parent.parent / "training_config.yaml"
    if config_path.exists():
        import yaml
        with open(config_path) as f:
            return yaml.safe_load(f)
    return {}
