# Runwatch — Project Brief for a Coding Agent

## Goal

Build a lightweight prototype of an always-on research experiment triage agent.

The core idea is to help researchers and research engineers monitor experiment runs, notice when something looks wrong or suspicious, and produce useful guidance on what to do next.

This should feel like a persistent research watchdog rather than a generic chatbot.

## What the product should do

The system should watch experiment-related signals and:

* identify when a run looks healthy versus problematic
* detect broad classes of issues such as instability, underperformance, overfitting, or suspicious results
* explain why a run may be failing or why a result should not yet be trusted
* recommend next actions or follow-up experiments

The goal is not full scientific automation. The goal is triage, reliability, and decision support.

## Product feel

The experience should communicate that the agent is:

* always watching
* able to compare runs and notice anomalies
* able to summarize what matters
* useful for researchers making fast decisions

It should feel more like a judge or watchdog than an assistant that waits for prompts.

## Scope guidance

Keep the scope narrow and practical.

The prototype should focus on:

* monitoring runs or experiment outputs
* surfacing issues clearly
* producing short, helpful diagnoses
* suggesting what to try next

Avoid trying to solve every research workflow.

## Positioning

This is a research reliability tool.

It helps teams avoid wasting time on bad runs, noisy improvements, or misleading experiment outcomes. The strongest framing is that it improves trust in experimental results and helps researchers react faster when experiments go off track.

## What to avoid

Do not turn this into:

* a generic research assistant
* a literature summarizer
* a broad autonomous scientist platform
* a general-purpose ML ops suite

Keep the concept centered on:

**monitor -> detect -> explain -> recommend**

## Success criteria

A good prototype should make it obvious that:

* the system understands experiment health at a high level
* it can flag likely problems without being prompted
* it can explain its reasoning in a useful way
* it can recommend sensible next steps for researchers

## One-line summary

Runwatch is an always-on experiment triage agent that helps researchers detect bad runs, investigate suspicious outcomes, and decide the next best experiment.
