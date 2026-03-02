# What is Flow?

Flow is a language for writing business rules that execute. A `.flow` file is simultaneously a process document anyone on your team can read and an executable program that runs the same way every time. One file. Versioned. Auditable. No translation layer between what the rule says and what the code does.

**Core principle:** The document becomes the execution.

## The problem Flow solves

In most organizations, business logic lives in too many places. The process doc says one thing. The code says another. A Slack thread from last quarter clarified an edge case that never made it into either. And now AI is making decisions too — scoring fraud risk, flagging transactions — with its logic buried in code nobody outside engineering can read. When a regulator asks "prove how this decision is made," nobody can point to one place.

Flow eliminates this gap. A `.flow` file **is** the rule. If it's in the file, it runs. If it's not, it doesn't. There's nothing to get out of sync.

## Who uses Flow?

Flow is designed for teams, not just individuals:

- **Operations teams** write and maintain `.flow` files. When a process changes, they change the file. No Jira ticket. No waiting for a sprint.
- **Engineers** build the APIs and services that Flow calls. They review `.flow` files in pull requests like any other code. They stop being bottlenecked by business logic changes.
- **Compliance and auditors** can read the actual rules. Hand them the `.flow` file — it reads like structured English. Try handing them 400 lines of Python.

The person who understands the process owns the process.

## What does Flow look like?

Here's a real Flow program that detects transaction fraud with AI-assisted risk scoring:

```txt
config:
    name: "Transaction Fraud Detection"
    version: 1

services:
    VelocityCheck is an API at "https://velocity.example.com/api"
        with headers:
            Authorization: "Bearer {env.VELOCITY_API_KEY}"
    RiskScorer is an AI using "anthropic/claude-sonnet-4-20250514"
    FraudOps is a webhook at "https://hooks.slack.com/services/fraud-ops"

workflow:
    trigger: when a transaction is submitted for authorization

    step RuleScreening:
        if amount is above 10000:
            set rule-score to rule-score plus 40
        if card-present is false:
            set rule-score to rule-score plus 20

    step AIRiskScoring:
        ask RiskScorer to analyze this transaction for fraud patterns
            save the result as assessment
            save the confidence as ai-confidence

    step Decision:
        if combined-score is above 75:
            set decision to "block"
        otherwise if combined-score is above 40:
            set decision to "review"
            notify fraud team using FraudOps with transaction transaction-id and score combined-score
        otherwise:
            set decision to "approve"

    complete with decision decision and score combined-score
```

This file is the rule. It runs. It's versioned. Anyone on the team can read it and know exactly what happens when a transaction is submitted.

## What Flow gives you

- **One source of truth** — The process document and the executable logic are the same artifact. No drift.
- **Readable by anyone** — Structured English syntax. Operations teams write it. Compliance teams audit it. Engineers review it in pull requests. It reads like a process document because it is one.
- **Versionable** — Lives in Git. Clean diffs. "Raised fraud threshold from 5000 to 10000" — one line, reviewed, merged.
- **Auditable** — Every execution is logged with full context. Hand the file and the log to an auditor.
- **Connects to anything** — REST APIs, webhooks, AI models. Stripe, SendGrid, Slack, GitHub, your internal services.
- **AI, governed** — AI is a named participant with explicit instructions, confidence thresholds, and fallback rules — all visible in the file. Not a black box.
- **Secure by design** — Seven constructs. No imports, no shell commands, no filesystem access. A `.flow` file can only do what it explicitly declares.
- **Catches mistakes early** — Flow checks your file for errors before anything runs and tells you exactly what's wrong in plain English.

## What Flow can't do (yet)

We'd rather be upfront about boundaries than let you find them the hard way.

- **No parallel execution** — Steps run one at a time, top to bottom. You can't fire off three API calls simultaneously. If you need that, you need a general-purpose language.
- **No pause and resume** — A workflow runs from start to finish in one go. There's no way to pause mid-workflow, wait for a human approval, and pick up where you left off.
- **No loops other than `for each`** — There are no `while` loops or infinite loops. Flow processes a list and moves on. This is intentional — it prevents runaway workflows.
- **No imports or modules** — Each `.flow` file is self-contained. You can't share logic between files or build a library of reusable steps.
- **No database or state** — Flow doesn't store anything between runs. It connects to services, processes data, and returns a result. Persistent state lives in your database, not in Flow.
- **No frontend or UI** — Flow runs on the server or your terminal. It doesn't render pages or handle user sessions.
- **No custom functions** — You can't define reusable subroutines within Flow. What you see is what runs.

Some of these are on the roadmap. Some are deliberate constraints that keep Flow simple. If your use case hits one of these walls, Flow might not be the right tool — and that's okay.

## How it works

When you run a `.flow` file, it goes through four stages:

1. **Parse** — Flow reads the file and understands the structure
2. **Analyze** — Flow checks for mistakes before anything runs (undefined services, typos, scope errors) and reports them in plain English with fix suggestions
3. **Execute** — Flow runs the workflow step by step, calling services and evaluating logic
4. **Report** — Flow returns structured output and a full execution log

The key part is stage 2: Flow catches your mistakes **before** running, so you never accidentally send bad data to a real service.

## Next steps

Ready to try it? Head to [Getting Started](/guide/getting-started) to install Flow and run your first business rule.
