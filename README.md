# Flow

```
# Order Processing Workflow
# This is real, runnable Flow code.

config:
    name: "Order Processing"
    version: 1
    timeout: 5 minutes

services:
    Inventory is an API at "https://inventory.example.com/api"
        with headers:
            Authorization: "Bearer {env.INVENTORY_KEY}"
    Stripe is a plugin "stripe-payments"
    Notifier is an AI using "openai/gpt-4o"

workflow:
    trigger: when a new order is placed

    set order-id to order.id
    set items to order.items
    log "Processing order {order-id}"

    step CheckInventory:
        for each item in items:
            check stock using Inventory with product item

    step CalculateTotal:
        set subtotal to order.subtotal
        set tax to subtotal times 0.08
        set total to subtotal plus tax

    step ChargePayment:
        charge payment using Stripe with amount total and currency "usd"
            save the status as payment-status
            on failure:
                retry 3 times waiting 5 seconds
                if still failing:
                    reject with "We could not process your payment. Please try again."

    step SendConfirmation:
        ask Notifier to write a friendly order confirmation
            save the result as confirmation
        log confirmation

    complete with status "processed" and order-id order-id and total total
```

**Flow is a programming language for people who aren't programmers.** It lets operations teams, business analysts, and product managers write automated workflows in structured English — no semicolons, no brackets, no classes. If you can write a process document, you can write a Flow program.

## Installation

```bash
npm install -g flow-lang
```

Requires Node.js 18 or later.

## Quick Start

```bash
# Check a file for errors
flow check my-workflow.flow

# Run with mock services (no real API calls)
flow test my-workflow.flow

# Run for real
flow run my-workflow.flow --input '{"order": {"id": "123", "items": ["A", "B"], "subtotal": 100}}'
```

## CLI Commands

```bash
flow check <file>                          # Parse and validate (no execution)
flow run <file>                            # Execute a .flow file
flow run <file> --input '<json>'           # Pass trigger data as JSON
flow run <file> --input-file data.csv      # Load input from JSON, CSV, or Excel file
flow run <file> --verbose                  # Show detailed execution log
flow run <file> --mock                     # Use mock services instead of real APIs
flow run <file> --strict-env               # Error on missing environment variables
flow run <file> --output-log run.json      # Write structured JSON log to file
flow test <file>                           # Dry-run with mock services
flow test <file> --verbose                 # Mock dry-run with execution log
flow test <file> --output-log test.json    # Write structured JSON log to file
flow serve <file-or-dir>                   # Start webhook server
flow serve <file-or-dir> --port 4000       # Custom port (default: 3000)
```

## Language Overview

Flow has exactly **7 constructs** and **5 data types**. That's the whole language.

### Service Calls

Call real REST APIs, AI models, webhooks, or plugins:

```
verify email using EmailVerifier with address email
get user using GitHub at "/users/octocat"
charge payment using Stripe with amount total and currency "usd"
    save the result as payment
    save the status as status-code
    save the response headers as resp-headers
```

### Conditions

```
if requested-amount is above 50000:
    set risk-adjustment to 1.5
otherwise if requested-amount is above 20000:
    set risk-adjustment to 0.75
otherwise:
    set risk-adjustment to 0
```

### AI Requests

Ask an AI model to do something, and save the response:

```
ask RiskAnalyst to assess the risk level of this loan application
    save the result as risk-assessment
    save the confidence as risk-confidence
```

Works with OpenAI and Anthropic models out of the box.

### Variables

```
set name to "Alice"
set total to subtotal plus tax
set monthly-payment to amount times rate divided by 1200
set monthly-payment to monthly-payment rounded to 2
```

### Loops

```
for each item in order.items:
    check stock using Inventory with product item
```

### Named Steps

Organize your workflow into labeled sections:

```
step VerifyIdentity:
    verify identity using IdentityService with applicant applicant-id
    log "Identity verified"
```

### Output

```
complete with status "approved" and rate final-rate
reject with "We could not verify your identity at this time."
log "Processing order {order-id}"
```

### Comparisons and Math

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

### Data Types

| Type | Example |
|---|---|
| Text | `"hello"`, `"Order {id} confirmed"` |
| Number | `42`, `3.14`, `0.08` |
| Boolean | `true`, `false` |
| List | `order.items` |
| Record | `order` (accessed via dot notation: `order.id`) |

There are no nulls. If a value doesn't exist, it's `empty` — and you can check for it with `is empty` or `is not empty`.

## Services

Flow connects to real external services:

```
services:
    # REST APIs — verb inference maps English to HTTP methods
    GitHub is an API at "https://api.github.com"
        with headers:
            Authorization: "token {env.GITHUB_TOKEN}"
            Accept: "application/vnd.github.v3+json"

    # AI agents — OpenAI and Anthropic supported
    Analyst is an AI using "openai/gpt-4o"
    Claude is an AI using "anthropic/claude-sonnet-4-20250514"

    # Webhooks — always POST
    SlackNotifier is a webhook at "https://hooks.slack.com/..."

    # Plugins — stub connector for future plugin system
    Stripe is a plugin "stripe-payments"
```

### HTTP Headers

Services can include custom headers for authentication and other needs. Header values support string interpolation with environment variables:

```
services:
    Stripe is an API at "https://api.stripe.com/v1"
        with headers:
            Authorization: "Bearer {env.STRIPE_SECRET_KEY}"
            Content-Type: "application/x-www-form-urlencoded"
```

### Response Metadata

After a service call, you can inspect the HTTP status code and response headers:

```
get user using GitHub at "/users/{username}"
    save the result as user
    save the status as status-code
    save the response headers as resp-headers

if status-code is 200:
    log "Found user: {user.name}"
    log "Rate limit remaining: {resp-headers.x-ratelimit-remaining}"
```

### API Keys

Create a `.env` file in your project root:

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...
```

Flow loads `.env` automatically via dotenv. Access any environment variable with `env.VARIABLE_NAME`.

## Error Messages

Flow doesn't show stack traces. Every error is written in plain English with the exact line, what went wrong, and how to fix it:

```
Error in loan-application.flow, line 12:

    verify the email using EmailChecker

    I don't know what "EmailChecker" is. You haven't declared it
    in your services block.

    Did you mean "EmailVerifier"?

    Hint: Every service must be declared at the top of your file:
        services:
            EmailChecker is an API at "https://..."
```

## Examples

The `examples/` directory has complete workflows:

- **email-verification.flow** — Validates a submitted email address
- **order-processing.flow** — Inventory check, payment, and confirmation
- **loan-application.flow** — Full pipeline: identity, credit, AI risk assessment, fraud screening, and approval
- **github-api.flow** — Authenticated GitHub API calls with custom headers
- **stripe-checkout.flow** — Stripe payment processing with status checks
- **slack-notification.flow** — Slack webhook notifications
- **sendgrid-email.flow** — SendGrid transactional email delivery

## Editor Support

The [Flow VS Code Extension](https://github.com/AbrahamOluwa/flow-lang/tree/main/flow-vscode) provides syntax highlighting and code snippets for `.flow` files. Install it from the `.vsix` file in the `flow-vscode/` directory:

1. Run `cd flow-vscode && npx @vscode/vsce package` to build the extension
2. In VS Code, open the Command Palette and select "Install from VSIX..."
3. Select the generated `flow-lang-0.1.0.vsix` file

## Contributing

```bash
git clone https://github.com/AbrahamOluwa/flow-lang.git
cd flow-lang
npm install
npm run build
npm run test
```

The test suite uses [Vitest](https://vitest.dev/) with 468 tests across all pipeline stages.

## License

MIT
