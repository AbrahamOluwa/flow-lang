# Examples

Real-world workflow examples built with Flow. Each example is a complete, runnable `.flow` file.

## Available examples

### [Email Verification](/examples/email-verification)

Validates an email address submitted through a form. Demonstrates service calls, conditionals, and completion/rejection.

```txt
verify email using EmailVerifier with address email

if email is not empty:
    complete with status "verified"
otherwise:
    reject with "The email address could not be verified"
```

### [Order Processing](/examples/order-processing)

Processes a new order: checks inventory, calculates totals with tax, charges payment with retry logic, and generates an AI confirmation message.

```txt
step CalculateTotal:
    set subtotal to order.subtotal
    set tax to subtotal times 0.08
    set total to subtotal plus tax
```

### [GitHub Scout](/examples/github-scout)

Fetches a GitHub user profile from the public API and evaluates their popularity and activity level. Works with real data — no API key needed.

```txt
get profile using GitHub at "/users/{request.username}"
    save the result as profile
set followers to profile.followers

if followers is above 1000:
    set popularity to "star"
```

### [Stripe Checkout](/examples/stripe-checkout)

Processes a payment through Stripe's API with authenticated headers, status checking, retry logic, and Slack notification.

```txt
services:
    Stripe is an API at "https://api.stripe.com/v1"
        with headers:
            Authorization: "Bearer {env.STRIPE_SECRET_KEY}"

step CreateCharge:
    create charge using Stripe with amount amount and currency currency
        save the result as charge
        save the status as status-code
        on failure:
            retry 3 times waiting 5 seconds
```

### [Slack Notification](/examples/slack-notification)

Sends a formatted deployment notification to Slack with conditional message building based on deploy status.

```txt
step BuildMessage:
    if deploy-status is "success":
        set message to "Deployed {service-name} v{version} successfully"
    otherwise if deploy-status is "rollback":
        set message to "Rolled back {service-name} to v{version}"
    otherwise:
        set message to "Deployment of {service-name} v{version} failed"
```

### [SendGrid Email](/examples/sendgrid-email)

Sends a transactional email through SendGrid with authentication, input validation, and delivery status verification.

```txt
services:
    SendGrid is an API at "https://api.sendgrid.com/v3"
        with headers:
            Authorization: "Bearer {env.SENDGRID_API_KEY}"
            Content-Type: "application/json"

step SendEmail:
    send email using SendGrid at "/mail/send" with to recipient and subject subject
        save the status as status-code
```

## Running examples

### With mock services

```bash
flow test examples/email-verification.flow --dry-run --verbose
```

### With real APIs

The GitHub Scout example works with real data:

```bash
flow run examples/github-scout.flow --input '{"username": "torvalds"}'
```

### As webhooks

Serve all examples as HTTP endpoints:

```bash
flow serve examples/ --mock --port 3000
```

Then trigger any workflow:

```bash
curl -X POST http://localhost:3000/github-scout \
  -H "Content-Type: application/json" \
  -d '{"username": "octocat"}'
```

## Creating your own

Every Flow file follows the same structure:

```txt
config:
    name: "My Workflow"
    version: 1

services:
    # Declare your services here

workflow:
    trigger: when something happens

    # Your logic here

    complete with result data
```

See the [Getting Started](/guide/getting-started) guide to create your first workflow, or the [Language Reference](/reference/language) for the complete syntax.
