# Flow Language for VS Code

Syntax highlighting, code snippets, and language support for [Flow](https://github.com/AbrahamOluwa/flow-lang) — a programming language for people who aren't programmers.

## Features

### Syntax Highlighting

Full syntax highlighting for `.flow` files:

- Keywords and control flow (`if`, `otherwise`, `for each`, `step`)
- Service declarations and references
- String interpolation (`"Hello {name}"`)
- Comparison operators (`is above`, `is not empty`, `contains`)
- Math operators (`plus`, `minus`, `times`, `divided by`)
- Comments (`# ...`)
- Numbers, booleans, and identifiers

### Code Snippets

Type a prefix and press Tab to expand:

| Prefix | Description |
|---|---|
| `workflow` | Complete .flow file skeleton |
| `step` | Named step block |
| `service-api` | API service with auth headers |
| `service-webhook` | Webhook service |
| `service-ai` | AI service (Anthropic/OpenAI) |
| `if-otherwise` | Conditional block |
| `for-each` | Loop over a collection |
| `retry` | Error handler with retry |

### Language Configuration

- Comment toggling with `Ctrl+/` (uses `#`)
- Auto-indentation after `:` blocks
- Auto-closing for `"` and `{`

## What is Flow?

Flow is a domain-specific language for writing automated workflows in structured English. It's designed for operations teams, business analysts, and other non-engineers who need to automate processes.

```
services:
    Stripe is an API at "https://api.stripe.com/v1"
        with headers:
            Authorization: "Bearer {env.STRIPE_SECRET_KEY}"

workflow:
    trigger: when a checkout is submitted

    step CreateCharge:
        create charge using Stripe with amount request.amount
            save the result as charge
            save the status as status-code
            on failure:
                retry 3 times waiting 5 seconds
                if still failing:
                    reject with "Payment failed"

    if status-code is 200:
        complete with status "paid"
```

## Installation

### From VS Code Marketplace

Search for "Flow Language" in the Extensions panel.

### From .vsix file

```bash
cd flow-vscode
npx @vscode/vsce package
code --install-extension flow-lang-0.1.0.vsix
```

## Links

- [Flow on GitHub](https://github.com/AbrahamOluwa/flow-lang)
- [Flow on npm](https://www.npmjs.com/package/flow-lang)
- [Documentation](https://abrahamoluwa.github.io/flow-lang/)
