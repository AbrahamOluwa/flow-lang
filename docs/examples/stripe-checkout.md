# Stripe Checkout

Processes a payment through Stripe's API with authentication, status checking, retry logic, and Slack notification.

## Full source

```txt
# Stripe Checkout
# Processes a payment through Stripe's API with authentication,
# status checking, retry logic, and Slack notification.

config:
    name: "Stripe Checkout"
    version: 1

services:
    Stripe is an API at "https://api.stripe.com/v1"
        with headers:
            Authorization: "Bearer {env.STRIPE_SECRET_KEY}"
    SlackNotifier is a webhook at "https://hooks.slack.com/services/placeholder"

workflow:
    trigger: when a checkout is submitted

    set email to request.customer_email
    set amount to request.amount
    set currency to request.currency
    log "Processing payment of {amount} {currency} for {email}"

    step CreateCharge:
        create charge using Stripe with amount amount and currency currency and receipt_email email
            save the result as charge
            save the status as status-code
            on failure:
                retry 3 times waiting 5 seconds
                if still failing:
                    log "Payment failed after 3 retries"
                    reject with "We could not process your payment. Please try again later."

    step VerifyPayment:
        if status-code is 200:
            log "Payment successful: {charge.id}"
        otherwise:
            log "Unexpected status: {status-code}"
            reject with "Payment was not completed successfully"

    step NotifyTeam:
        send notification using SlackNotifier with text "Payment received: {amount} {currency} from {email}"

    log "Checkout complete"
    complete with status "paid" and charge-id charge.id and email email
```

## What this does

1. **Reads checkout data** from the incoming request (email, amount, currency)
2. **Creates a charge** through the Stripe API with Bearer token authentication
3. **Retries up to 3 times** if the API call fails, waiting 5 seconds between attempts
4. **Checks the HTTP status** — rejects the workflow if the charge didn't succeed
5. **Notifies the team** via a Slack webhook
6. **Completes** with the payment status and charge ID

## Concepts demonstrated

- **Authenticated API headers** — `with headers:` block with env var interpolation
- **HTTP status checking** — `save the status as status-code` + conditional on status
- **Retry with real delays** — `retry 3 times waiting 5 seconds`
- **Webhook services** — `SlackNotifier is a webhook at "..."`
- **Multiple outputs** — `complete with status "paid" and charge-id charge.id and email email`
- **Nested dot access** — `charge.id` to read fields from API responses

## Running it

```bash
# Test with mock services (no API keys needed)
flow run examples/stripe-checkout.flow --mock \
  --input '{"customer_email": "ada@example.com", "amount": 5000, "currency": "usd"}'

# Run with real Stripe (requires env vars)
export STRIPE_SECRET_KEY=sk_test_...
flow run examples/stripe-checkout.flow \
  --input '{"customer_email": "ada@example.com", "amount": 5000, "currency": "usd"}'
```

## As a webhook

```bash
flow serve examples/stripe-checkout.flow --mock

curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"customer_email": "ada@example.com", "amount": 5000, "currency": "usd"}'
```
