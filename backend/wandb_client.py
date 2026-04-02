"""
W&B data fetching client for RunWatcher.
Connects to the filobayesian-bocconi-university/gemma-lora-training project
and provides cached access to run data and history.
"""

import os
import time
import math
from typing import Optional

import wandb

ENTITY = os.getenv("WANDB_ENTITY", "filobayesian-bocconi-university")
PROJECT = os.getenv("WANDB_PROJECT", "gemma-lora-training")
PROJECT_PATH = f"{ENTITY}/{PROJECT}"

CACHE_TTL = 60  # seconds

# In-memory cache
_cache: dict = {
    "runs": None,
    "runs_ts": 0,
    "history": {},       # run_id -> history list
    "history_ts": {},    # run_id -> timestamp
}


def _sanitize_value(v):
    """Convert NaN/Inf floats to None for JSON serialization."""
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def _sanitize_dict(d: dict) -> dict:
    """Sanitize all values in a dict."""
    return {k: _sanitize_value(v) for k, v in d.items()}


def _get_api() -> wandb.Api:
    """Create a W&B API client with a generous timeout."""
    return wandb.Api(timeout=60)


def get_all_runs(force_refresh: bool = False) -> list[dict]:
    """
    Fetch all runs from the W&B project and return summaries.
    Results are cached for CACHE_TTL seconds.

    Returns a list of dicts with keys:
        name, id, state, runtime_seconds, created_at, config, summary_metrics
    """
    now = time.time()
    if (
        not force_refresh
        and _cache["runs"] is not None
        and (now - _cache["runs_ts"]) < CACHE_TTL
    ):
        return _cache["runs"]

    api = _get_api()
    runs = api.runs(PROJECT_PATH)

    result = []
    for run in runs:
        # Extract a clean config summary
        config = dict(run.config) if run.config else {}
        model_cfg = config.get("model", {})
        training_cfg = config.get("training", {})
        lora_cfg = model_cfg.get("lora", {})

        # Determine model size from run name for fallback
        is_9b = "9b" in run.name
        fallback_model = "google/gemma-2-9b-it" if is_9b else "google/gemma-2-2b-it"

        config_summary = {
            "base_model": model_cfg.get("base_model", config.get("base_model", fallback_model)),
            "lora_r": lora_cfg.get("r", config.get("lora_r", 16)),
            "lr": training_cfg.get("learning_rate", config.get("learning_rate", 1e-5)),
            "epochs": training_cfg.get("epochs", config.get("epochs", 5)),
            "kl_coef": training_cfg.get("kl_coef", config.get("kl_coef", 0.01)),
        }

        # Sanitize summary metrics
        summary = _sanitize_dict(dict(run.summary)) if run.summary else {}

        # Build metrics summary with keys the frontend expects
        metrics_summary = {}
        key_map = {
            "train/reward_mean": "final_reward_mean",
            "train/mean_f_score": "final_f_score",
            "train/kl_divergence": "final_kl",
            "train/gradient_norm": "final_gradient_norm",
        }
        for src_key, dst_key in key_map.items():
            if src_key in summary:
                metrics_summary[dst_key] = summary[src_key]

        result.append({
            "name": run.name,
            "id": run.id,
            "state": run.state,
            "runtime_seconds": int(run.summary.get("_runtime", 0)) if run.summary else 0,
            "created_at": run.created_at,
            "config": config,
            "config_summary": config_summary,
            "summary_metrics": summary,
            "metrics_summary": metrics_summary,
        })

    _cache["runs"] = result
    _cache["runs_ts"] = time.time()
    return result


def get_run_history(run_id: str, force_refresh: bool = False) -> list[dict]:
    """
    Fetch the full time-series history for a specific run.
    The run is identified by its W&B run ID.
    Results are cached for CACHE_TTL seconds.

    Returns a list of dicts, one per logged step.
    """
    now = time.time()
    if (
        not force_refresh
        and run_id in _cache["history"]
        and (now - _cache["history_ts"].get(run_id, 0)) < CACHE_TTL
    ):
        return _cache["history"][run_id]

    # Use the _wandb_runs cache to avoid re-fetching the entire runs list
    target_run = _find_wandb_run(run_id)
    if target_run is None:
        return []

    # Fetch history as a dataframe, then convert to list of dicts
    try:
        history_df = target_run.history(pandas=True)
        if history_df is None or history_df.empty:
            _cache["history"][run_id] = []
            _cache["history_ts"][run_id] = time.time()
            return []

        # Convert to list of dicts and sanitize NaN values
        rows = []
        for _, row in history_df.iterrows():
            sanitized = {}
            for col in history_df.columns:
                val = row[col]
                if hasattr(val, 'item'):
                    val = val.item()
                sanitized[col] = _sanitize_value(val)
            rows.append(sanitized)

        _cache["history"][run_id] = rows
        _cache["history_ts"][run_id] = time.time()
        return rows

    except Exception:
        # Fallback: try scan_history for non-pandas approach
        try:
            rows = []
            for row in target_run.scan_history():
                rows.append(_sanitize_dict(dict(row)))
            _cache["history"][run_id] = rows
            _cache["history_ts"][run_id] = time.time()
            return rows
        except Exception:
            return []


# Cache raw wandb run objects so get_run_history doesn't re-fetch the list
_wandb_runs_cache: list = []
_wandb_runs_ts: float = 0


def _find_wandb_run(run_id: str):
    """Find a raw wandb Run object by id or name, using a cached runs list."""
    global _wandb_runs_cache, _wandb_runs_ts
    now = time.time()
    if not _wandb_runs_cache or (now - _wandb_runs_ts) > CACHE_TTL:
        api = _get_api()
        _wandb_runs_cache = list(api.runs(PROJECT_PATH))
        _wandb_runs_ts = time.time()
    for run in _wandb_runs_cache:
        if run.id == run_id or run.name == run_id:
            return run
    return None


def get_run_by_name(run_name: str) -> Optional[dict]:
    """
    Find a run by its name from the cached run list.
    Returns the run summary dict or None.
    """
    runs = get_all_runs()
    for run in runs:
        if run["name"] == run_name:
            return run
    return None


def get_history_summary(history: list[dict]) -> dict:
    """
    Create a compact summary of the history for sending to Claude.
    Includes first 5, last 5 rows, and min/max/mean of key metrics.
    """
    if not history:
        return {"rows": 0, "first": [], "last": [], "stats": {}}

    key_metrics = [
        "train/reward_mean", "train/mean_f_score",
        "train/kl_divergence", "train/reward_std",
        "train/gradient_norm",
    ]

    # First 5 and last 5 rows, filtered to key metrics
    def extract_keys(row: dict) -> dict:
        result = {}
        for k in key_metrics:
            if k in row:
                result[k] = row[k]
        if "_step" in row:
            result["_step"] = row["_step"]
        return result

    first_5 = [extract_keys(r) for r in history[:5]]
    last_5 = [extract_keys(r) for r in history[-5:]]

    # Compute stats for each key metric
    stats = {}
    for metric in key_metrics:
        values = [r[metric] for r in history if metric in r and r[metric] is not None]
        if values:
            stats[metric] = {
                "min": min(values),
                "max": max(values),
                "mean": sum(values) / len(values),
                "first": values[0],
                "last": values[-1],
                "count": len(values),
            }

    return {
        "total_rows": len(history),
        "first_5": first_5,
        "last_5": last_5,
        "stats": stats,
    }
