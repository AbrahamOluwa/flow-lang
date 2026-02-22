# Language Reference

This is the complete syntax reference for the Flow language.

## File structure

A Flow file has three optional top-level blocks:

```txt
config:
    name: "My Workflow"
    version: 1
    timeout: 5 minutes

services:
    MyAPI is an API at "https://api.example.com"

workflow:
    trigger: when something happens
    # logic goes here
```

All three blocks are optional, but a useful workflow will have at least `workflow:`.

## Config block

Metadata about your workflow:

```txt
config:
    name: "Order Processing"
    version: 1
    timeout: 5 minutes
```

| Key | Type | Description |
|---|---|---|
| `name` | Text | Display name for the workflow |
| `version` | Number | Version number |
| `timeout` | Duration | Maximum execution time (e.g., `5 minutes`) — declared but not currently enforced by the runtime; serves as documentation for your workflow's expected duration |

## Services block

Declare external services:

```txt
services:
    GitHub is an API at "https://api.github.com"
        with headers:
            Authorization: "token {env.GITHUB_TOKEN}"
    Stripe is a plugin "stripe-payments"
    Analyst is an AI using "openai/gpt-4o"
    SlackNotifier is a webhook at "https://hooks.slack.com/..."
```

Four service types:
- **API** — REST endpoints: `<Name> is an API at "<url>"`
- **Webhook** — POST endpoints: `<Name> is a webhook at "<url>"`
- **Plugin** — Named plugins: `<Name> is a plugin "<plugin-name>"`
- **AI** — AI models: `<Name> is an AI using "<provider/model>"`

### Custom headers

API and webhook services can include custom HTTP headers:

```txt
services:
    Stripe is an API at "https://api.stripe.com/v1"
        with headers:
            Authorization: "Bearer {env.STRIPE_SECRET_KEY}"
            Content-Type: "application/x-www-form-urlencoded"
```

Header values support string interpolation with `{env.VARIABLE_NAME}`. Headers are sent with every request to that service.

## Workflow block

### Trigger

Declares what starts the workflow:

```txt
workflow:
    trigger: when a new order is placed
```

The trigger line is a human-readable label. Flow does not parse or enforce it — it appears in logs and in the metadata returned by `flow serve` (see [Webhook Server](/guide/webhook-server#workflow-info)).

### Steps

Named blocks that organize your workflow:

```txt
step ValidateOrder:
    # logic here

step ProcessPayment:
    # logic here
```

Steps are organizational only — they execute in order and share the same variable scope. Steps always execute top to bottom. There is no way to skip, repeat, or call steps out of order — use `if` conditions inside a step to control what happens.

## Variables

### Setting variables

```txt
set name to "Alice"
set count to 42
set active to true
set items to ["apple", "banana", "cherry"]
```

### String interpolation

Use curly braces inside strings:

```txt
set greeting to "Hello, {name}!"
log "Processing order {order-id} with {item-count} items"
```

### Accessing nested data

Use dot notation:

```txt
set email to user.email
set city to user.address.city
```

## Service calls

### Basic syntax

```txt
<verb> <description> using <Service>
```

### With URL path

```txt
get profile using GitHub at "/users/{username}"
    save the result as profile
```

### With parameters

```txt
create order using Stripe with amount total and currency "usd"
```

### Saving results

```txt
get data using MyAPI at "/endpoint"
    save the result as data
```

### Saving response metadata

Capture the HTTP status code and response headers:

```txt
create item using API with name "widget"
    save the result as item
    save the status as status-code
    save the response headers as resp-headers
```

- `save the status as` — stores the HTTP status code as a number (e.g., `200`, `201`)
- `save the response headers as` — stores response headers as a record of text values

All three save clauses can be used together. When using mock services, status and headers will be `empty`.

### Error handling

```txt
charge payment using Stripe with amount total
    on failure:
        retry 3 times waiting 5 seconds
        if still failing:
            reject with "Payment failed"
```

The `waiting` duration is a real pause between retry attempts. You can use `seconds` or `minutes`:

```txt
    on failure:
        retry 2 times waiting 30 seconds

    on failure:
        retry 3 times waiting 1 minutes
```

If you don't include `on failure`, the workflow stops immediately when a service call fails and reports the error. Add `on failure` to any service call where you want to handle errors gracefully.

## AI requests

```txt
ask Analyst to summarize the quarterly report
    save the result as summary
```

The response has two fields:
- `summary.result` — the AI's text response
- `summary.confidence` — confidence score (0 to 1)

## Conditions

### if / otherwise if / otherwise

```txt
if score is above 90:
    set grade to "A"
otherwise if score is above 80:
    set grade to "B"
otherwise:
    set grade to "C"
```

### Comparison operators

| Operator | Meaning |
|---|---|
| `is` | Equals |
| `is not` | Not equals |
| `is above` | Greater than |
| `is below` | Less than |
| `is at least` | Greater than or equal |
| `is at most` | Less than or equal |
| `contains` | Text/list contains value |
| `is empty` | Value is empty |
| `is not empty` | Value is not empty |
| `exists` | Value exists (not empty) |
| `does not exist` | Value does not exist |

## Loops

### for each

```txt
for each item in order.items:
    log "Processing: {item}"
    check stock using Inventory with product item
```

Loop variables are scoped to the loop body — they don't leak into the outer scope.

### Looping over objects

Access fields on each item with dot notation:

```txt
for each person in team.members:
    log "{person.name} — {person.role}"
    if person.role is "lead":
        set lead-email to person.email
```

## Math

```txt
set total to subtotal plus tax
set difference to price minus discount
set area to width times height
set average to total divided by count
set rounded to value rounded to 2 places
```

| Operator | Description |
|---|---|
| `plus` | Addition (or text concatenation) |
| `minus` | Subtraction |
| `times` | Multiplication |
| `divided by` | Division |
| `rounded to N places` | Rounding |

When both values are text, `plus` concatenates them.

## Output

### Complete

End the workflow with output data:

```txt
complete with status "ok"
complete with name name and email email and role "admin"
```

Multiple key-value pairs are separated with `and`.

### Reject

End the workflow with an error message:

```txt
reject with "Invalid email address"
```

When served as a webhook, `complete with` returns HTTP 200 and `reject with` returns HTTP 400. See [Webhook Server](/guide/webhook-server#what-comes-back) for details.

### Log

Print a message during execution:

```txt
log "Processing order {order-id}"
log total
```

## Indentation

Flow uses **4 spaces** for indentation. Tabs are not allowed.

```txt
if active:
    log "Active"          # 4 spaces — correct
    set status to "on"    # 4 spaces — correct
```

## Comments

Lines starting with `#` are comments:

```txt
# This is a comment (must be on its own line)
set name to "Alice"
# Comments cannot go at the end of a line
```

## Environment variables

Access environment variables with the `env` prefix:

```txt
set api-key to env.API_KEY
set debug to env.DEBUG_MODE
```

Flow automatically reads a `.env` file from the directory where you run the command. You can also set variables in your shell. Use `--strict-env` to fail if any referenced variables are missing.

## Request data

When you run `flow run` with `--input`, the JSON data becomes the `request` object. When served as a webhook via `flow serve`, the POST body becomes `request`. Access fields with dot notation:

```txt
set name to request.name
set email to request.email
set items to request.order.items
```
