"""
Heuristic detection engine for RunWatcher.
Detects common training pathologies in RL finetuning runs.
"""

from typing import Optional


def _extract_metric(history: list[dict], key: str) -> list[float]:
    """Extract a list of non-None values for a given metric key from history."""
    return [
        row[key] for row in history
        if key in row and row[key] is not None
    ]


def _trend(values: list[float]) -> Optional[float]:
    """
    Compute a simple linear trend (slope) over a list of values.
    Returns positive for upward trend, negative for downward.
    Returns None if too few values.
    """
    if len(values) < 2:
        return None
    n = len(values)
    x_mean = (n - 1) / 2.0
    y_mean = sum(values) / n
    numerator = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    denominator = sum((i - x_mean) ** 2 for i in range(n))
    if denominator == 0:
        return 0.0
    return numerator / denominator


def detect_reward_hacking(history: list[dict]) -> dict:
    """
    Detect reward hacking: reward goes up but faithfulness goes down.
    The model is gaming the reward by stuffing happy words instead of
    being faithful to the movie summary.
    """
    result = {
        "detected": False,
        "severity": "healthy",
        "type": "reward_hacking",
        "detail": "",
    }

    reward_values = _extract_metric(history, "train/reward_mean")
    f_score_values = _extract_metric(history, "train/mean_f_score")

    if len(reward_values) < 5 or len(f_score_values) < 5:
        result["detail"] = "Insufficient data for reward hacking detection."
        return result

    reward_trend = _trend(reward_values)
    f_score_trend = _trend(f_score_values)

    if reward_trend is None or f_score_trend is None:
        result["detail"] = "Could not compute trends."
        return result

    # Check if reward is going up and faithfulness is going down
    reward_going_up = reward_trend > 0
    f_score_going_down = f_score_trend < 0

    if reward_going_up and f_score_going_down:
        result["detected"] = True

        # Check severity: critical if faithfulness drops > 0.2 from start to end
        f_drop = f_score_values[0] - f_score_values[-1]
        reward_rise = reward_values[-1] - reward_values[0]

        if f_drop > 0.2:
            result["severity"] = "critical"
            result["detail"] = (
                f"Reward hacking detected: reward increased by {reward_rise:.3f} "
                f"while faithfulness dropped by {f_drop:.3f}. "
                f"The model is likely gaming the reward function."
            )
        else:
            result["severity"] = "warning"
            result["detail"] = (
                f"Possible reward hacking: reward trending up (+{reward_rise:.3f}) "
                f"while faithfulness trending down (-{f_drop:.3f}). "
                f"Monitor closely."
            )
    else:
        result["detail"] = "No reward hacking pattern detected."

    return result


def detect_mode_collapse(history: list[dict]) -> dict:
    """
    Detect mode collapse: reward_std approaches 0 and gradient_norm approaches 0.
    The policy collapsed to producing a single output.
    """
    result = {
        "detected": False,
        "severity": "healthy",
        "type": "mode_collapse",
        "detail": "",
    }

    reward_std_values = _extract_metric(history, "train/reward_std")
    grad_norm_values = _extract_metric(history, "train/gradient_norm")

    if len(reward_std_values) < 10:
        result["detail"] = "Insufficient data for mode collapse detection."
        return result

    # Check the last 10% of steps
    last_pct = max(1, len(reward_std_values) // 10)
    tail_reward_std = reward_std_values[-last_pct:]
    avg_tail_reward_std = sum(tail_reward_std) / len(tail_reward_std)

    # Also check gradient norms if available
    grad_near_zero = False
    if len(grad_norm_values) >= 10:
        tail_grad = grad_norm_values[-last_pct:]
        avg_tail_grad = sum(tail_grad) / len(tail_grad)
        grad_near_zero = avg_tail_grad < 0.01

    # Critical if reward_std < 0.005 for last 10% of steps
    if avg_tail_reward_std < 0.005:
        result["detected"] = True
        result["severity"] = "critical"
        result["detail"] = (
            f"Mode collapse detected: reward_std averaged {avg_tail_reward_std:.5f} "
            f"over the last {last_pct} steps (threshold: 0.005). "
            f"{'Gradient norms also near zero.' if grad_near_zero else ''} "
            f"The policy has collapsed to producing near-identical outputs."
        )
    elif avg_tail_reward_std < 0.02 and grad_near_zero:
        result["detected"] = True
        result["severity"] = "warning"
        result["detail"] = (
            f"Possible mode collapse: reward_std={avg_tail_reward_std:.5f}, "
            f"gradient norms near zero. The policy diversity is very low."
        )
    else:
        result["detail"] = "No mode collapse pattern detected."

    return result


def detect_training_stall(history: list[dict]) -> dict:
    """
    Detect training stall: reward_mean hasn't improved by more than 0.01
    over the last 20% of steps.
    """
    result = {
        "detected": False,
        "severity": "healthy",
        "type": "training_stall",
        "detail": "",
    }

    reward_values = _extract_metric(history, "train/reward_mean")

    if len(reward_values) < 10:
        result["detail"] = "Insufficient data for training stall detection."
        return result

    # Look at last 20% of steps
    last_pct = max(2, len(reward_values) // 5)
    tail_values = reward_values[-last_pct:]

    improvement = max(tail_values) - min(tail_values)

    if improvement < 0.01:
        result["detected"] = True
        result["severity"] = "warning"
        result["detail"] = (
            f"Training stall detected: reward_mean changed by only {improvement:.4f} "
            f"over the last {last_pct} steps (last 20%). "
            f"Current reward: {tail_values[-1]:.4f}. "
            f"The model has stopped learning."
        )
    else:
        result["detail"] = (
            f"No stall: reward improved by {improvement:.4f} in the last 20% of training."
        )

    return result


def detect_kl_collapse(history: list[dict]) -> dict:
    """
    Detect KL collapse: kl_divergence drops to 0.001 (the floor) and stays there.
    The policy stopped exploring.
    """
    result = {
        "detected": False,
        "severity": "healthy",
        "type": "kl_collapse",
        "detail": "",
    }

    kl_values = _extract_metric(history, "train/kl_divergence")

    if len(kl_values) < 10:
        result["detail"] = "Insufficient data for KL collapse detection."
        return result

    # Check the last 20% of values
    last_pct = max(2, len(kl_values) // 5)
    tail_kl = kl_values[-last_pct:]
    avg_tail_kl = sum(tail_kl) / len(tail_kl)

    # Check if KL is stuck at the floor (0.001)
    at_floor = all(v <= 0.002 for v in tail_kl)

    if at_floor and avg_tail_kl <= 0.0015:
        result["detected"] = True
        result["severity"] = "warning"
        result["detail"] = (
            f"KL collapse detected: kl_divergence averaged {avg_tail_kl:.5f} "
            f"over the last {last_pct} steps, stuck at the floor (0.001). "
            f"The policy has stopped exploring and is very close to the reference model."
        )
    else:
        result["detail"] = (
            f"No KL collapse: average KL in last 20% is {avg_tail_kl:.4f}."
        )

    return result


def detect_infrastructure_failure(run_data: dict) -> dict:
    """
    Detect infrastructure failure: run state is failed/crashed with 0 summary metrics.
    """
    result = {
        "detected": False,
        "severity": "healthy",
        "type": "infrastructure_failure",
        "detail": "",
    }

    state = run_data.get("state", "")
    summary = run_data.get("summary_metrics", {})

    # Filter out internal wandb keys to count real metrics
    real_metrics = {
        k: v for k, v in summary.items()
        if not k.startswith("_") and v is not None
    }

    if state in ("failed", "crashed"):
        if len(real_metrics) == 0:
            result["detected"] = True
            result["severity"] = "critical"
            result["detail"] = (
                f"Infrastructure failure: run state is '{state}' with no logged metrics. "
                f"The run likely crashed before training began (OOM, config error, etc.)."
            )
        else:
            # Run crashed mid-training — not an infra failure, just an incomplete run
            result["detail"] = f"Run {state} mid-training with {len(real_metrics)} metrics logged."
    elif state == "killed":
        result["detail"] = f"Run was manually killed with {len(real_metrics)} metrics logged."
    else:
        result["detail"] = f"Run state is '{state}', no infrastructure failure detected."

    return result


def classify_run(run_data: dict, history: list[dict]) -> dict:
    """
    Run all detectors on a given run and return overall status + issues.

    Returns:
        {
            "status": "healthy" | "warning" | "critical",
            "issues": [list of detected issues]
        }
    """
    issues = []

    # Run infrastructure check first (doesn't need history)
    infra_result = detect_infrastructure_failure(run_data)
    if infra_result["detected"]:
        issues.append(infra_result)

    # Run history-based detectors only if we have history data
    if history:
        detectors = [
            detect_reward_hacking,
            detect_mode_collapse,
            detect_training_stall,
            detect_kl_collapse,
        ]
        for detector in detectors:
            result = detector(history)
            if result["detected"]:
                issues.append(result)

    # Determine overall status
    severities = [issue["severity"] for issue in issues]
    if "critical" in severities:
        overall = "critical"
    elif "warning" in severities:
        overall = "warning"
    else:
        overall = "healthy"

    return {
        "status": overall,
        "issues": issues,
    }
