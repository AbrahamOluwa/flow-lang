# Getting Started

Flow has two kinds of users: **engineers** who set up the environment, and **ops teams** who write and maintain the workflow logic. Pick your track.

## For engineers

You'll install Flow, configure services, and set up the repo so your ops team can start writing workflows.

### 1. Install Flow

Flow runs on [Node.js](https://nodejs.org/) 18 or higher.

```bash
npm install -g flow-lang
```

Verify it worked:

```bash
flow --version
```

### 2. Set up a project

Create a directory for your team's workflows:

```bash
mkdir workflows && cd workflows
git init
```

Create a `.env` file for API keys and secrets (add this to `.gitignore`):

```bash
# .env
STRIPE_SECRET_KEY=sk_test_...
SENDGRID_API_KEY=SG...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### 3. Write a starter workflow

Create `order-review.flow` to give your ops team a working example:

```txt
config:
    name: "Order Review"
    version: 1

services:
    Inventory is an API at "https://inventory.yourcompany.com/api"
    Slack is a webhook at "https://hooks.slack.com/services/..."

workflow:
    trigger: when a new order is submitted

    set order-id to request.order_id
    set total to request.total
    log "Reviewing order {order-id}: ${total}"

    if total is above 5000:
        send alert using Slack with text "Large order {order-id}: ${total} — needs manual review"
        complete with status "flagged" and order-id order-id

    check stock using Inventory with order-id order-id
        save the result as stock
        on failure:
            retry 2 times waiting 5 seconds
            if still failing:
                reject with "Could not reach inventory system"

    complete with status "approved" and order-id order-id
```

### 4. Validate and test

Check for errors without running:

```bash
flow check order-review.flow
```

Test with mock services (no real API calls):

```bash
flow test order-review.flow --dry-run --verbose
```

Run with real services:

```bash
flow run order-review.flow --input '{"order_id": "ORD-123", "total": 7500}'
```

::: tip Windows users
Windows CMD and PowerShell handle quotes differently. Use escaped double quotes:
```bash
flow run order-review.flow --input "{\"order_id\": \"ORD-123\", \"total\": 7500}"
```
:::

### 5. Deploy as a webhook (optional)

Turn your workflows into HTTP endpoints:

```bash
flow serve workflows/ --port 3000
```

Each `.flow` file becomes a POST endpoint. `order-review.flow` becomes `POST /order-review`:

```bash
curl -X POST http://localhost:3000/order-review \
  -H "Content-Type: application/json" \
  -d '{"order_id": "ORD-123", "total": 7500}'
```

### 6. Hand it off

Once the repo is set up, your ops team only needs to:
- Edit `.flow` files in any text editor (VS Code recommended — there's a [Flow extension](/guide/getting-started#vs-code-extension))
- Submit pull requests for review
- They never touch npm, the terminal, or service configuration

Share the [ops team track below](#for-ops-teams) with them.

---

## For ops teams

Your engineer has set up a repository with Flow. Here's how to write and change workflows.

### What you'll need

- A text editor (VS Code is recommended)
- Access to the Git repository your engineer set up
- That's it — you don't need to install anything else

### The basics

A `.flow` file has three sections:

```txt
config:
    name: "My Workflow"
    version: 1

services:
    # Your engineer has set these up — don't change
    # them without checking with the team

workflow:
    trigger: when something happens

    # Your logic goes here
```

- **config** — The name and version of your workflow
- **services** — External systems the workflow talks to (APIs, webhooks, AI). Your engineer configures these.
- **workflow** — The rules and logic. **This is the part you own.**

### Your first change

Let's say your team has a workflow that flags orders over $5,000. The business decides to change the threshold to $10,000. Open the `.flow` file and find:

```txt
if total is above 5000:
```

Change it to:

```txt
if total is above 10000:
```

That's it. Submit a pull request. Your engineer reviews it, merges it, and the new rule is live. One line changed, clear diff, no ambiguity about what the rule is.

### Writing logic

Here are the building blocks you'll use most:

**Setting variables:**
```txt
set name to request.customer_name
set total to request.amount
```

**Making decisions:**
```txt
if total is above 1000:
    log "Large order"
otherwise:
    log "Standard order"
```

**Processing lists:**
```txt
for each item in request.items:
    log "Checking: {item}"
```

**Logging:**
```txt
log "Processing order {order-id}"
```

**Finishing the workflow:**
```txt
complete with status "approved" and total total
reject with "Order cannot be processed"
```

### Indentation matters

Flow uses **4 spaces** for indentation. Everything inside a block must be indented by exactly 4 spaces:

```txt
if active:
    log "User is active"          # 4 spaces
    if score is above 90:
        set grade to "A"          # 8 spaces (4 + 4)
```

In VS Code, look for "Indent Using Spaces" in the bottom status bar and set it to 4.

### How to know if you made a mistake

Ask your engineer to run `flow check` on your file, or if you have Flow installed locally:

```bash
flow check my-workflow.flow
```

Flow catches mistakes before anything runs and tells you exactly what's wrong:

```
Error in my-workflow.flow, line 7:

    log greting

    I don't recognize "greting" — it hasn't been defined yet.

    Did you mean "greeting"?
```

### Reading input data

Data passed into your workflow is available as `request`. If someone sends `{"customer": "Alice", "amount": 500}`, you access it like:

```txt
set name to request.customer
set total to request.amount
```

### Tips

- **Start by reading existing workflows.** Your engineer has set up examples. Read them before writing your own.
- **Make small changes.** Change one rule at a time. Submit a PR. See it work. Then make the next change.
- **Use comments to explain why.** The code shows *what* happens. Comments explain *why*:

```txt
# Compliance requires manual review for amounts over 10,000
if total is above 10000:
    complete with status "flagged"
```

## VS Code extension

Flow has a VS Code extension that adds syntax highlighting, snippets, and auto-indentation. Your engineer can install it from the `.vsix` file in the [`flow-vscode/`](https://github.com/AbrahamOluwa/flow-lang/tree/main/flow-vscode) directory.

## Next steps

- [Services](/guide/services) — How Flow connects to external APIs (for engineers)
- [AI Integration](/guide/ai-integration) — Use AI models in your workflows
- [Language Reference](/reference/language) — Complete syntax guide
- [Examples](/examples/) — Real-world workflows you can learn from
- [Playground](/playground/) — Try Flow in your browser, no install needed
