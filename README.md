# Flow

**Business rules that run, not rot.**

Flow is a language for writing business logic as plain text that executes. A `.flow` file is simultaneously a process document anyone can read, an executable program, a versioned artifact, and an audit trail. One file. No drift between what the rule says and what the code does.

```
services:
    CreditBureau is an API at "https://credit.example.com/api"
    SendGrid is an API at "https://api.sendgrid.com/v3"
        with headers:
            Authorization: "Bearer {env.SENDGRID_API_KEY}"

workflow:
    trigger: when a loan application is submitted

    step Check Credit:
        fetch credit report using CreditBureau with bvn application.bvn
            save the result as report

        if report.score is below 350:
            send rejection using SendGrid to application.email
            reject with "Credit score too low"

    step Approve:
        log "Approved: {application.name}, score {report.score}"
        complete with status "approved" and applicant application.name
```

This file **is** the rule. It runs. It's versioned. Anyone on the team can read it.

## Why Flow exists

In most organizations, business logic lives in too many places. The process doc says one thing. The code says another. A Slack thread from last quarter clarified an edge case that never made it into either.

Every change goes through engineering. "Change the threshold from 300 to 350" becomes a Jira ticket, a sprint, and a deploy — for a one-line change.

Flow eliminates this gap:
- **Operations teams** write and maintain `.flow` files. When a rule changes, they change the file and submit a PR.
- **Engineers** set up the services and infrastructure, then review PRs. They stop being bottlenecked by business logic changes.
- **Compliance** can read the actual rules. Hand them the file — it reads like structured English.

## Installation

```bash
npm install -g flow-lang
```

Requires Node.js 18 or later.

## Quick start

```bash
# Check a file for errors (no execution)
flow check my-workflow.flow

# Run with mock services (no real API calls)
flow test my-workflow.flow --dry-run --verbose

# Run for real
flow run my-workflow.flow --input '{"application": {"name": "Ada", "bvn": "12345"}}'

# Serve as a webhook endpoint
flow serve my-workflow.flow --port 3000
```

## The language

Flow has exactly **7 constructs** and **5 data types**. That's the whole language.

### Service calls

```
verify email using EmailVerifier with address email
get user using GitHub at "/users/octocat"
    save the result as user
    save the status as status-code
    on failure:
        retry 3 times waiting 5 seconds
```

### Conditions

```
if total is above 5000:
    set review to "manual"
otherwise if total is above 1000:
    set review to "automated"
otherwise:
    set review to "none"
```

### AI requests

```
ask Analyst to assess the risk level of this application
    save the result as assessment
```

Works with OpenAI and Anthropic models out of the box.

### Variables and math

```
set name to "Alice"
set total to subtotal plus tax
set monthly to amount divided by 12 rounded to 2 places
```

### Loops

```
for each item in order.items:
    check stock using Inventory with product item
```

### Named steps

```
step VerifyIdentity:
    verify identity using IdentityService with id applicant-id
    log "Identity verified"
```

### Output

```
complete with status "approved" and total total
reject with "Credit score too low"
log "Processing order {order-id}"
```

### Comparisons

Flow uses English words instead of symbols:

| Instead of | Flow uses |
|---|---|
| `==` | `is` |
| `!=` | `is not` |
| `>` | `is above` |
| `<` | `is below` |
| `>=` | `is at least` |
| `<=` | `is at most` |
| `+` | `plus` |
| `-` | `minus` |
| `*` | `times` |
| `/` | `divided by` |

### Data types

| Type | Example |
|---|---|
| Text | `"hello"`, `"Order {id} confirmed"` |
| Number | `42`, `3.14` |
| Boolean | `true`, `false` |
| List | `order.items` |
| Record | `order` (dot access: `order.id`) |

No nulls. Missing values are `empty` — check with `is empty` or `is not empty`.

## Services

```
services:
    # REST APIs with auth headers
    GitHub is an API at "https://api.github.com"
        with headers:
            Authorization: "token {env.GITHUB_TOKEN}"

    # AI models (OpenAI and Anthropic)
    Analyst is an AI using "openai/gpt-4o"

    # Webhooks
    Slack is a webhook at "https://hooks.slack.com/..."

    # Plugins
    Stripe is a plugin "stripe-payments"
```

API keys go in a `.env` file. Flow loads it automatically.

## Error messages

Flow catches mistakes before execution and explains them in plain English:

```
Error in loan-review.flow, line 12:

    verify the email using EmailChecker

    I don't know what "EmailChecker" is. You haven't declared it
    in your services block.

    Did you mean "EmailVerifier"?
```

## What Flow can't do (yet)

We'd rather be upfront:

- **No parallel execution** — steps run sequentially
- **No pause/resume** — workflows run start to finish
- **No while loops** — only `for each` over lists
- **No imports** — each `.flow` file is self-contained
- **No persistent state** — Flow doesn't store data between runs
- **No custom functions** — what you see is what runs

Some of these are on the roadmap. Some are deliberate constraints.

## Examples

The [`examples/`](examples/) directory has complete workflows:

- **email-verification.flow** — Email validation with conditionals
- **order-processing.flow** — Inventory, payment, AI confirmation
- **github-scout.flow** — GitHub API with popularity scoring
- **stripe-checkout.flow** — Stripe payments with retry and Slack notification
- **slack-notification.flow** — Deployment notifications
- **sendgrid-email.flow** — Transactional email with status verification
- **loan-application.flow** — Full pipeline: credit, risk, fraud, approval

## Documentation

- [Landing page](https://abrahamoluwa.github.io/flow-lang/) — What Flow is and why it exists
- [Getting Started](https://abrahamoluwa.github.io/flow-lang/guide/getting-started) — Two-track guide for engineers and ops teams
- [Language Reference](https://abrahamoluwa.github.io/flow-lang/reference/language) — Complete syntax
- [Playground](https://abrahamoluwa.github.io/flow-lang/playground/) — Try Flow in the browser, no install

## Editor support

The [Flow VS Code Extension](https://github.com/AbrahamOluwa/flow-lang/tree/main/flow-vscode) adds syntax highlighting and snippets. Build and install:

```bash
cd flow-vscode && npx @vscode/vsce package
```

Then in VS Code: Command Palette → "Install from VSIX..." → select the `.vsix` file.

## Contributing

```bash
git clone https://github.com/AbrahamOluwa/flow-lang.git
cd flow-lang
npm install
npm run build
npm run test    # 468 tests across all pipeline stages
```

## License

MIT
