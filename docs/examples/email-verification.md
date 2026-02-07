# Email Verification

A workflow that validates an email address submitted through a form.

## Full source

```txt
# Email Verification Workflow
# Validates a submitted email address and returns the result.

config:
    name: "Email Verification"
    version: 1

services:
    EmailVerifier is an API at "https://verify.example.com/api"

workflow:
    trigger: when a form is submitted

    set email to signup.email
    log "Verifying email: {email}"

    verify email using EmailVerifier with address email

    if email is not empty:
        log "Email is valid"
        complete with status "verified" and email email
    otherwise:
        reject with "The email address could not be verified"
```

## What this does

1. **Extracts the email** from the incoming form submission (`signup.email`)
2. **Calls an external API** to verify the email address
3. **Checks the result** — if the email is valid, completes with a success status
4. **Rejects** if the email could not be verified

## Concepts demonstrated

- **Service declaration** — declaring an API with a base URL
- **Variable assignment** — `set email to signup.email`
- **String interpolation** — `"Verifying email: {email}"`
- **Service calls with parameters** — `verify email using EmailVerifier with address email`
- **Conditional logic** — `if` / `otherwise`
- **Completion and rejection** — `complete with` / `reject with`

## Running it

```bash
# Test with mock services
flow test examples/email-verification.flow --dry-run --verbose

# Run with input
flow run examples/email-verification.flow \
  --mock \
  --input '{"signup": {"email": "alice@example.com"}}'
```

## As a webhook

```bash
flow serve examples/email-verification.flow --mock

curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"signup": {"email": "alice@example.com"}}'
```
