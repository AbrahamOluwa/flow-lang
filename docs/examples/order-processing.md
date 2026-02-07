# Order Processing

A workflow that validates inventory, calculates totals with tax, charges payment with retry logic, and generates an AI confirmation message.

## Full source

```txt
# Order Processing Workflow
# Validates inventory, calculates totals, and charges payment for a new order.

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

    # Step 1: Validate inventory for each item
    step CheckInventory:
        set item-count to 0
        for each item in items:
            check stock using Inventory with product item
            set item-count to item-count plus 1
        log "Checked {item-count} items"

    # Step 2: Calculate the order total
    step CalculateTotal:
        set subtotal to order.subtotal
        set tax to subtotal times 0.08
        set total to subtotal plus tax
        log "Order total: {total}"

    # Step 3: Charge the customer
    step ChargePayment:
        charge payment using Stripe with amount total and currency "usd"
            on failure:
                retry 3 times waiting 5 seconds
                if still failing:
                    log "Payment failed after retries"
                    reject with "We could not process your payment. Please try again."

    # Step 4: Generate a confirmation message
    step SendConfirmation:
        ask Notifier to write a friendly order confirmation
            save the result as confirmation
        log confirmation

    complete with status "processed" and order-id order-id and total total
```

## What this does

1. **Extracts order data** from the incoming request
2. **Checks inventory** for each item in the order using a loop
3. **Calculates the total** with 8% tax
4. **Charges payment** via Stripe with retry logic — retries 3 times on failure
5. **Generates a confirmation** using AI
6. **Outputs** the order status, ID, and total

## Concepts demonstrated

- **Named steps** — organizing workflow into logical sections
- **Loops** — `for each item in items`
- **Math operations** — `subtotal times 0.08`, `subtotal plus tax`
- **Error handling** — `on failure: retry 3 times waiting 5 seconds`
- **AI integration** — `ask Notifier to write a friendly order confirmation`
- **Multiple service types** — API, plugin, and AI in one workflow

## Running it

```bash
# Test with mock services
flow test examples/order-processing.flow --dry-run --verbose

# Run with input
flow run examples/order-processing.flow \
  --mock \
  --input '{"order": {"id": "ORD-001", "items": ["widget", "gadget"], "subtotal": 49.99}}'
```

## As a webhook

```bash
flow serve examples/order-processing.flow --mock

curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"order": {"id": "ORD-001", "items": ["widget"], "subtotal": 29.99}}'
```
