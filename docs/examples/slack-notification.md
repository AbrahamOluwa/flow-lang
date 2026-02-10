# Slack Notification

Sends a formatted deployment notification to a Slack channel with conditional message building.

## Full source

```txt
# Slack Notification
# Sends a formatted deployment notification to a Slack channel.

config:
    name: "Slack Notification"
    version: 1

services:
    Slack is a webhook at "https://hooks.slack.com/services/placeholder"

workflow:
    trigger: when a deployment event occurs

    set event to request.event
    set service-name to request.service
    set version to request.version
    set deploy-status to request.status
    log "Preparing notification for {service-name} {event}"

    step BuildMessage:
        if deploy-status is "success":
            set message to "Deployed {service-name} v{version} successfully"
            set emoji to "white_check_mark"
        otherwise if deploy-status is "rollback":
            set message to "Rolled back {service-name} to v{version}"
            set emoji to "warning"
        otherwise:
            set message to "Deployment of {service-name} v{version} failed"
            set emoji to "x"

    step SendNotification:
        send alert using Slack with text message and icon_emoji emoji
            on failure:
                retry 2 times waiting 3 seconds
                if still failing:
                    log "Could not reach Slack"

    log "Notification sent: {message}"
    complete with status "notified" and message message
```

## What this does

1. **Reads deployment event data** from the incoming request
2. **Builds a message** based on the deployment status (success, rollback, or failure)
3. **Sends the message** to Slack via a webhook
4. **Retries** if the Slack webhook is unreachable
5. **Completes** with the notification status and message

## Concepts demonstrated

- **Webhook services** — `Slack is a webhook at "..."`
- **Multi-branch conditionals** — `if` / `otherwise if` / `otherwise`
- **String interpolation** — `"Deployed {service-name} v{version} successfully"`
- **Retry on failure** — `retry 2 times waiting 3 seconds`
- **Named steps** — `step BuildMessage:` and `step SendNotification:`

## Running it

```bash
# Test with mock services
flow run examples/slack-notification.flow --mock \
  --input '{"event": "deploy", "service": "api-v2", "version": "1.4.0", "status": "success"}'

# Try with a rollback status
flow run examples/slack-notification.flow --mock \
  --input '{"event": "deploy", "service": "api-v2", "version": "1.3.9", "status": "rollback"}'
```

## As a webhook

```bash
flow serve examples/slack-notification.flow --mock

curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"event": "deploy", "service": "api-v2", "version": "1.4.0", "status": "success"}'
```
