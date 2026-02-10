# SendGrid Email

Sends a transactional email through the SendGrid API with authentication, input validation, status checking, and retry on failure.

## Full source

```txt
# SendGrid Email
# Sends a transactional email through the SendGrid API with
# authentication, status checking, and retry on failure.

config:
    name: "SendGrid Email"
    version: 1

services:
    SendGrid is an API at "https://api.sendgrid.com/v3"
        with headers:
            Authorization: "Bearer {env.SENDGRID_API_KEY}"
            Content-Type: "application/json"

workflow:
    trigger: when an email needs to be sent

    set recipient to request.to
    set subject to request.subject
    set body to request.body
    log "Sending email to {recipient}: {subject}"

    step ValidateInput:
        if recipient is empty:
            reject with "Recipient email address is required"
        if subject is empty:
            reject with "Email subject is required"

    step SendEmail:
        send email using SendGrid at "/mail/send" with to recipient and subject subject and content body
            save the result as result
            save the status as status-code
            on failure:
                retry 2 times waiting 10 seconds
                if still failing:
                    log "SendGrid is unreachable after retries"
                    reject with "Could not send email. Please try again later."

    step VerifyDelivery:
        if status-code is 202:
            log "Email accepted for delivery"
        otherwise if status-code is 200:
            log "Email sent successfully"
        otherwise:
            log "Unexpected response status: {status-code}"

    complete with status "sent" and recipient recipient and subject subject
```

## What this does

1. **Reads email parameters** from the incoming request (to, subject, body)
2. **Validates input** — rejects immediately if the recipient or subject is missing
3. **Sends the email** through SendGrid's `/mail/send` endpoint with Bearer authentication
4. **Retries up to 2 times** if the API call fails, waiting 10 seconds between attempts
5. **Checks the HTTP status** — SendGrid returns 202 for accepted, 200 for sent
6. **Completes** with the delivery status and recipient info

## Concepts demonstrated

- **Authenticated API headers** — `with headers:` with multiple headers (Authorization + Content-Type)
- **URL path building** — `at "/mail/send"` appended to the base URL
- **Input validation** — `if recipient is empty: reject with "..."`
- **HTTP status checking** — `save the status as status-code` with multi-branch conditional
- **Retry with delays** — `retry 2 times waiting 10 seconds`
- **Early rejection** — `reject with` exits the workflow immediately on validation failure

## Running it

```bash
# Test with mock services (no API key needed)
flow run examples/sendgrid-email.flow --mock \
  --input '{"to": "ada@example.com", "subject": "Welcome!", "body": "Thanks for signing up."}'

# Run with real SendGrid (requires env var)
export SENDGRID_API_KEY=SG.your_key_here
flow run examples/sendgrid-email.flow \
  --input '{"to": "ada@example.com", "subject": "Welcome!", "body": "Thanks for signing up."}'
```

## As a webhook

```bash
flow serve examples/sendgrid-email.flow --mock

curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"to": "ada@example.com", "subject": "Welcome!", "body": "Thanks for signing up."}'
```
