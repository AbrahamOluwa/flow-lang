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
    Stripe is a plugin "stripe-payments"
    Notifier is an AI using "anthropic/claude-sonnet-4-20250514"

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

The interpreter is built in TypeScript. It reads `.flow` files, checks them for errors with plain-English messages, and executes them.

## Quick Start

```bash
npm install
npm run build
flow run examples/order-processing.flow --input '{"order": {"id": "123", "items": ["A", "B"], "subtotal": 100}}'
```

## Language Overview

Flow has exactly **7 constructs** and **5 data types**. That's the whole language.

### Service Calls

Call an external API, plugin, or webhook:

```
verify email using EmailVerifier with address email
charge payment using Stripe with amount total and currency "usd"
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

## CLI Commands

```bash
flow check <file>        # Parse and validate a .flow file (no execution)
flow run <file>          # Execute a .flow file
flow run <file> --input '{"key": "value"}'   # Pass trigger data as JSON
flow run <file> --verbose                     # Show detailed execution log
flow test <file>         # Dry-run with mock services
flow test <file> --dry-run --verbose          # Preview execution without side effects
```

## Project Structure

```
src/
  lexer/          # Turns source text into tokens
  parser/         # Turns tokens into an abstract syntax tree
  analyzer/       # Validates the tree (catches errors before running)
  runtime/        # Executes the tree
  cli/            # Command-line interface
  types/          # Shared type definitions
  errors/         # Error formatting and suggestions
tests/            # 351 tests across all stages
examples/         # Three complete .flow programs
```

The interpreter pipeline:

```
.flow file  -->  Lexer  -->  Parser  -->  Analyzer  -->  Runtime
  (text)        (tokens)      (tree)     (validated)    (result)
```

## Project Status

| Component | Status | Tests |
|---|---|---|
| Lexer | Done | 100 |
| Parser | Done | 64 |
| Semantic Analyzer | Done | 41 |
| Runtime + CLI | Done | 115 |
| Error Formatting | Done | 14 |
| Integration Tests | Done | 17 |
| **Total** | | **351** |

### What's Next

- [ ] Real service connectors (HTTP, webhooks)
- [ ] VS Code extension with syntax highlighting
- [ ] REPL for interactive testing
- [ ] `flow init` scaffolding command
- [ ] Published npm package

## Examples

The `examples/` directory has three complete workflows:

- **email-verification.flow** — Validates a submitted email address
- **order-processing.flow** — Inventory check, payment, and confirmation
- **loan-application.flow** — Full pipeline: identity, credit, AI risk assessment, fraud screening, and approval

## Contributing

```bash
git clone https://github.com/AbrahamOluwa/flow-lang.git
cd flow-lang
npm install
npm run build
npm run test
```

The test suite uses [Vitest](https://vitest.dev/). Run `npm run test` to see all 351 tests pass.

If you're adding a new feature, write tests first. Each stage of the pipeline (lexer, parser, analyzer, runtime) has its own test directory with helper functions — check the existing tests for patterns to follow.

## License

MIT
