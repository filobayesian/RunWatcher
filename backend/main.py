"""
RunWatcher FastAPI backend.
Serves experiment monitoring data and Claude-powered analysis.
"""

import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Load .env from the project root (parent of backend/)
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(_env_path)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from wandb_client import get_all_runs, get_run_history, get_run_by_name, get_history_summary
from heuristics import classify_run
from agents import monitor_diagnosis, scientist_recommendation, load_training_config

logger = logging.getLogger("runwatcher")
logging.basicConfig(level=logging.INFO)

# Track last check time and issues count
_state = {
    "last_check": None,
    "issues_found": 0,
    "classified_runs": None,  # cached result of list_runs
    "classified_ts": 0,
}

CLASSIFY_CACHE_TTL = 120  # seconds


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-fetch run data on startup so the first request is fast."""
    logger.info("RunWatcher starting up — pre-fetching W&B data...")
    try:
        runs = get_all_runs()
        _state["last_check"] = datetime.now(timezone.utc).isoformat()

        # Classify all runs and count issues
        issues = 0
        for run_data in runs:
            history = []
            # Only fetch history for runs that have metrics
            real_metrics = {
                k: v for k, v in run_data.get("summary_metrics", {}).items()
                if not k.startswith("_") and v is not None
            }
            if real_metrics:
                history = get_run_history(run_data["id"])
            classification = classify_run(run_data, history)
            if classification["status"] != "healthy":
                issues += classification["issues"].__len__()

        _state["issues_found"] = issues
        logger.info(
            f"Pre-fetch complete: {len(runs)} runs loaded, {issues} issues detected."
        )
    except Exception as e:
        logger.error(f"Startup pre-fetch failed: {e}")

    yield  # App runs

    logger.info("RunWatcher shutting down.")


app = FastAPI(
    title="RunWatcher",
    description="ML experiment monitoring agent for W&B runs",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status")
def get_status():
    """Overall agent status."""
    try:
        runs = get_all_runs()
        _state["last_check"] = datetime.now(timezone.utc).isoformat()
    except Exception:
        runs = []

    return {
        "agent_name": "RunWatcher",
        "status": "monitoring",
        "project": os.getenv("WANDB_PROJECT", "gemma-lora-training"),
        "entity": os.getenv("WANDB_ENTITY", "filobayesian-bocconi-university"),
        "total_runs": len(runs),
        "last_check": _state["last_check"],
        "issues_found": _state["issues_found"],
    }


@app.get("/api/runs")
def list_runs():
    """List all runs with heuristic classification. Cached to avoid slow W&B fetches."""
    import time as _time
    now = _time.time()

    # Return cached result if fresh (invalidated when .env/code changes trigger reload)
    if _state["classified_runs"] is not None and (now - _state["classified_ts"]) < CLASSIFY_CACHE_TTL:
        return _state["classified_runs"]

    _state["classified_runs"] = None  # clear stale cache

    try:
        runs = get_all_runs()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch W&B data: {e}")

    _state["last_check"] = datetime.now(timezone.utc).isoformat()
    total_issues = 0
    result = []

    MIN_RUNTIME = 3600  # Only show runs longer than 1 hour for demo clarity

    for run_data in runs:
        runtime = run_data.get("runtime_seconds") or 0
        if runtime < MIN_RUNTIME:
            continue

        # Fetch history for classification
        history = []
        real_metrics = {
            k: v for k, v in run_data.get("summary_metrics", {}).items()
            if not k.startswith("_") and v is not None
        }
        if real_metrics:
            try:
                history = get_run_history(run_data["id"])
            except Exception:
                pass

        classification = classify_run(run_data, history)
        total_issues += len(classification["issues"])

        result.append({
            "name": run_data["name"],
            "id": run_data["id"],
            "state": run_data["state"],
            "status": classification["status"],
            "runtime_seconds": run_data.get("runtime_seconds"),
            "created_at": run_data.get("created_at"),
            "issues": classification["issues"],
            "config_summary": run_data.get("config_summary", {}),
            "metrics_summary": run_data.get("metrics_summary", {}),
        })

    _state["issues_found"] = total_issues
    _state["classified_runs"] = result
    _state["classified_ts"] = now
    return result


@app.get("/api/runs/{run_name}/diagnosis")
def get_diagnosis(run_name: str):
    """Get Claude-powered diagnosis for a specific run."""
    run_data = get_run_by_name(run_name)
    if run_data is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_name}' not found.")

    # Fetch history
    history = []
    try:
        history = get_run_history(run_data["id"])
    except Exception:
        pass

    # Run heuristics
    classification = classify_run(run_data, history)

    # Build history summary for Claude
    history_sum = get_history_summary(history)

    # Get Claude diagnosis
    diagnosis_text = monitor_diagnosis(run_data, classification, history_sum)

    return {
        "run_name": run_name,
        "diagnosis": diagnosis_text,
        "heuristic_alerts": classification["issues"],
        "status": classification["status"],
    }


@app.get("/api/runs/{run_name}/scientist")
def get_scientist_recommendation(run_name: str):
    """Get scientist agent recommendation for a specific run."""
    run_data = get_run_by_name(run_name)
    if run_data is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_name}' not found.")

    # First get the diagnosis
    history = []
    try:
        history = get_run_history(run_data["id"])
    except Exception:
        pass

    classification = classify_run(run_data, history)
    history_sum = get_history_summary(history)
    diagnosis_text = monitor_diagnosis(run_data, classification, history_sum)

    # Load training config
    training_config = load_training_config()

    # Get scientist recommendation
    recommendation = scientist_recommendation(diagnosis_text, training_config)

    return {
        "run_name": run_name,
        "diagnosis_summary": diagnosis_text,
        "proposed_changes": recommendation.get("proposed_changes", ""),
        "rationale": recommendation.get("rationale", ""),
        "verification_test": recommendation.get("verification_test", ""),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
