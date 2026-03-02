# Flow

**Business rules that run, not rot.**

Flow is a governance language for business decisions. A `.flow` file is simultaneously a policy document that compliance can read, an executable program that runs in production, and a versioned audit trail. When a regulator asks "prove how this decision is made," you hand them the file.

```
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

This file **is** the rule. It runs. It's versioned. A compliance officer can read it. An auditor can verify it. An ops lead can change it in a pull request.

## Why Flow exists

Business decisions in regulated industries — fraud detection, KYC, claims processing, lending — need to be **provable**. Regulators ask how decisions are made. Auditors need to verify the rules match the documentation. Compliance teams need to read the actual logic, not a summary written after the fact.

In most organizations, that logic is scattered: a process doc says one thing, the code says another, and a Slack thread from last quarter clarified an edge case that never made it into either. When something goes wrong, nobody can point to one source of truth.

Flow eliminates this gap. The rule and the documentation are the same artifact:
- **Operations teams** write and maintain `.flow` files. When a policy changes, they change the file and submit a PR — one line, reviewed, merged.
- **Engineers** set up the services and infrastructure, then review PRs. They stop being bottlenecked by every business logic change.
- **Compliance and auditors** read the actual rules. Hand them the `.flow` file — it reads like structured English. Try handing them 400 lines of Python.

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
flow run my-workflow.flow --input '{"transaction": {"id": "txn-001", "amount": 8500}}'

# Serve as a webhook endpoint
flow serve my-workflow.flow --port 3000

# Run on a schedule (every 5 minutes)
flow schedule my-workflow.flow --every "5 minutes" --mock
```

## CLI

```bash
flow check <file>                          # Parse and validate (no execution)
flow run <file>                            # Execute a .flow file
flow run <file> --input '<json>'           # Pass input data as JSON
flow run <file> --input-file data.csv      # Load input from JSON, CSV, or Excel
flow run <file> --verbose                  # Show detailed execution log
flow run <file> --mock                     # Use mock services instead of real APIs
flow run <file> --strict-env               # Error on missing environment variables
flow run <file> --output-log run.json      # Write structured JSON execution log
flow test <file>                           # Dry-run with mock services
flow test <file> --verbose                 # Mock dry-run with execution log
flow test <file> --output-log test.json    # Write structured JSON log
flow serve <file-or-dir>                   # Start webhook server
flow serve <file-or-dir> --port 4000       # Custom port (default: 3000)
flow serve <file-or-dir> --mock            # Serve with mock connectors
flow serve <file-or-dir> --auth-token xyz  # Require Bearer token for requests
flow serve <file-or-dir> --cors            # Enable CORS for all origins
flow serve <file-or-dir> --cors-origin URL # Enable CORS for a specific origin
flow schedule <file> --every "5 minutes"   # Run on a human-readable schedule
flow schedule <file> --cron "*/5 * * * *"  # Run on a cron schedule
flow schedule <file> --every "day at 9:00" # Run daily at a specific time
flow schedule <file> --output-log ./logs/  # Write timestamped logs per run
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

    # SQLite databases
    LocalDB is a database at "./inventory.sqlite"

    # PostgreSQL databases
    ProdDB is a database at "postgresql://user:pass@host:5432/mydb"

    # Plugins
    Stripe is a plugin "stripe-payments"
```

API keys go in a `.env` file. Flow loads it automatically. Use `--strict-env` to fail on missing variables.

### Databases

Flow supports both SQLite (for local development and simple apps) and PostgreSQL (for production). The connector is selected automatically based on the connection string:

```
services:
    # SQLite — file path or :memory:
    LocalDB is a database at "./data.sqlite"

    # PostgreSQL — connection string starting with postgresql:// or postgres://
    ProdDB is a database at "postgresql://user:pass@localhost:5432/mydb"
```

Both use the same query syntax:

```
get customer using ProdDB at "customers" with email "ada@example.com"
    save the result as customer

list orders using ProdDB at "orders" with status "active"
    save the result as orders

insert record using ProdDB at "audit_log" with action "login" and user_id user-id
    save the result as entry

count rows using ProdDB at "orders" with status "pending"
    save the result as pending-count
```

### Response metadata

After a service call, you can capture the HTTP status code and response headers:

```
get user using GitHub at "/users/{username}"
    save the result as user
    save the status as status-code
    save the response headers as resp-headers

if status-code is 200:
    log "Found user: {user.name}"
    log "Rate limit remaining: {resp-headers.x-ratelimit-remaining}"
```

## Scheduling

Run any workflow on a recurring schedule without external tools like cron or Task Scheduler:

```bash
# Human-readable schedules
flow schedule my-report.flow --every "5 minutes"
flow schedule my-report.flow --every "2 hours"
flow schedule my-report.flow --every "day at 9:00"
flow schedule my-report.flow --every "monday at 9:00"

# Or use cron expressions directly
flow schedule my-report.flow --cron "0 */6 * * *"

# With input data and logging
flow schedule my-report.flow --every "day at 18:00" \
  --input '{"region": "us-east"}' \
  --output-log ./logs/ \
  --verbose
```

Each execution writes a timestamped JSON log when `--output-log` points to a directory. Press Ctrl+C for a clean shutdown.

## Architecture

```
.flow file → Lexer → Parser → Analyzer → Runtime
  (text)    (tokens)   (AST)  (validated)  (result)
```

TypeScript. Each stage is independent and testable in isolation. 571 tests. No `any` types.

- **Lexer** — Tokenizes source text with Python-style INDENT/DEDENT, string interpolation, and compound keyword matching
- **Parser** — Recursive descent, produces a typed AST for all 7 constructs
- **Analyzer** — Static checks before execution: service resolution, variable def-before-use, scope validation, duplicate detection
- **Runtime** — Async tree-walking interpreter with real HTTP calls, AI SDK integration, retry with actual delays, and structured logging

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
- **No custom functions** — what you see is what runs

Some of these are on the roadmap. Some are deliberate constraints that keep Flow auditable.

## Examples

The [`examples/`](examples/) directory has production-style workflows for regulated industries:

- **transaction-fraud.flow** — AI risk scoring, rule-based screening, human escalation
- **payment-reconciliation.flow** — Batch reconciliation with loop totals and AI discrepancy analysis
- **chargeback-dispute.flow** — Evidence gathering, AI recommendation, and dispute submission
- **loan-application.flow** — Full pipeline: credit check, risk assessment, fraud screening, approval
- **customer-db.flow** — PostgreSQL customer lookup with loyalty tier classification
- **daily-sales-report.flow** — Scheduled daily sales aggregation with Slack notification
- **sla-monitor.flow** — Scheduled service health checks with PagerDuty alerting
- **inventory-lookup.flow** — Database queries with stock level checks
- **stripe-checkout.flow** — Stripe payments with retry and Slack notification

[Try them in the browser](https://abrahamoluwa.github.io/flow-lang/playground/) — no install required.

## Documentation

- [Landing page](https://abrahamoluwa.github.io/flow-lang/) — What Flow is and why it exists
- [Getting Started](https://abrahamoluwa.github.io/flow-lang/guide/getting-started) — Two-track guide for engineers and ops teams
- [Language Reference](https://abrahamoluwa.github.io/flow-lang/reference/language) — Complete syntax
- [Services Guide](https://abrahamoluwa.github.io/flow-lang/guide/services) — APIs, databases, AI, webhooks
- [Scheduling Guide](https://abrahamoluwa.github.io/flow-lang/guide/scheduling) — Run workflows on recurring schedules
- [Playground](https://abrahamoluwa.github.io/flow-lang/playground/) — Try Flow in the browser, no install

## CORS

If browser-based clients need to call your Flow server, enable CORS:

```bash
# Allow all origins
flow serve ./workflows/ --cors

# Allow a specific origin
flow serve ./workflows/ --cors-origin "https://my-app.example.com"

# Or via environment variable
export FLOW_CORS_ORIGIN=https://my-app.example.com
flow serve ./workflows/
```

CORS preflight requests (OPTIONS) work even when authentication is enabled.

## Authentication

Protect your webhook server with a Bearer token:

```bash
# Via CLI flag
flow serve ./workflows/ --auth-token my-secret-token

# Or via environment variable
export FLOW_AUTH_TOKEN=my-secret-token
flow serve ./workflows/
```

Clients must include the token in every request:

```bash
curl -X POST http://localhost:3000/email-verification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret-token" \
  -d '{"signup": {"email": "test@example.com"}}'
```

The `/health` endpoint is always public (no token required) so load balancers can check server status.

## Docker

Run Flow workflows in a container:

```bash
docker build -t flow-server .
docker run -p 3000:3000 -v ./workflows:/workflows flow-server
```

With authentication, CORS, and environment variables:

```bash
docker run -p 3000:3000 \
  -v ./workflows:/workflows \
  -e FLOW_AUTH_TOKEN=my-secret-token \
  -e FLOW_CORS_ORIGIN=https://my-app.example.com \
  -e API_KEY=your-api-key \
  flow-server
```

The default entrypoint runs `flow serve /workflows --port 3000`. Override with custom arguments:

```bash
docker run -p 4000:4000 -v ./my-flow.flow:/app/my-flow.flow \
  flow-server serve /app/my-flow.flow --port 4000 --mock --cors
```

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
npm run test    # 571 tests across all pipeline stages
```

## License

MIT
