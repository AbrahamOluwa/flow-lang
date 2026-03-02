# SLA Monitor

This workflow checks the health of critical services and alerts via PagerDuty when any are down or unresponsive. It's designed to run on a recurring schedule (e.g. every 5 minutes) to catch outages early.

## What it does

1. **Checks each service** — Sends a GET request to each service's health endpoint
2. **Retries on failure** — Tries twice more before marking a service as down
3. **Counts failures** — Tracks how many services are down
4. **Alerts if needed** — Sends a PagerDuty alert with details of which services failed
5. **Logs everything** — Reports the status of each service check

## Key concepts

- **Scheduling** — Designed for `flow schedule --every "5 minutes"`
- **Health checking** — Uses HTTP status codes to determine service health
- **Retry with backoff** — Retries failed health checks before alerting
- **Conditional alerting** — Only sends PagerDuty alerts when services are actually down
- **String accumulation** — Builds a summary string of failed services

## The workflow

```txt
config:
    name: "SLA Monitor"
    version: 1

services:
    PaymentAPI is an API at "https://api.payments.example.com"
    InventoryAPI is an API at "https://inventory.example.com/api"
    NotificationAPI is an API at "https://notify.example.com/api"
    PagerDuty is a webhook at "https://events.pagerduty.com/v2/enqueue"

workflow:
    trigger: when a health check cycle runs

    set failed-services to 0
    set checked-services to 0
    set status-summary to ""

    step CheckPaymentAPI:
        get health using PaymentAPI at "/health"
            save the result as payment-health
            save the status as payment-status
            on failure:
                retry 2 times waiting 3 seconds
                if still failing:
                    set payment-status to 0

        set checked-services to checked-services plus 1
        if payment-status is not 200:
            set failed-services to failed-services plus 1
            set status-summary to status-summary plus "PaymentAPI: DOWN. "
            log "ALERT: PaymentAPI is not responding"
        otherwise:
            log "PaymentAPI: healthy"

    step CheckInventoryAPI:
        get health using InventoryAPI at "/health"
            save the result as inventory-health
            save the status as inventory-status
            on failure:
                retry 2 times waiting 3 seconds
                if still failing:
                    set inventory-status to 0

        set checked-services to checked-services plus 1
        if inventory-status is not 200:
            set failed-services to failed-services plus 1
            set status-summary to status-summary plus "InventoryAPI: DOWN. "
            log "ALERT: InventoryAPI is not responding"
        otherwise:
            log "InventoryAPI: healthy"

    step CheckNotificationAPI:
        get health using NotificationAPI at "/health"
            save the result as notification-health
            save the status as notification-status
            on failure:
                retry 2 times waiting 3 seconds
                if still failing:
                    set notification-status to 0

        set checked-services to checked-services plus 1
        if notification-status is not 200:
            set failed-services to failed-services plus 1
            set status-summary to status-summary plus "NotificationAPI: DOWN. "
            log "ALERT: NotificationAPI is not responding"
        otherwise:
            log "NotificationAPI: healthy"

    step AlertIfNeeded:
        if failed-services is above 0:
            set alert-message to "{failed-services} of {checked-services} services are down. {status-summary}"
            log "Sending PagerDuty alert: {alert-message}"
            send alert using PagerDuty with summary alert-message and severity "critical"
                on failure:
                    retry 3 times waiting 5 seconds
                    if still failing:
                        log "CRITICAL: Could not reach PagerDuty"
        otherwise:
            log "All {checked-services} services are healthy"

    complete with checked checked-services and failed failed-services and status status-summary
```

## Running it

### One-time health check

```bash
flow test examples/sla-monitor.flow --verbose
```

### On a 5-minute schedule

```bash
flow schedule examples/sla-monitor.flow --every "5 minutes" --mock --verbose
```

### With log history

Keep a record of every health check:

```bash
flow schedule examples/sla-monitor.flow \
  --every "5 minutes" \
  --output-log ./logs/health/ \
  --verbose
```

## Adapting for your use case

**Add more services:** Copy any `Check*` step and change the service name and URL. Add a new service declaration for each.

**Change the alert target:** Replace PagerDuty with Slack, OpsGenie, or any webhook:

```txt
services:
    Slack is a webhook at "https://hooks.slack.com/services/..."
```

**Change the frequency:** Run more or less often depending on your SLA requirements:

```bash
flow schedule monitor.flow --every "1 minute"    # Critical services
flow schedule monitor.flow --every "30 minutes"  # Non-critical services
```

**Add authentication:** If your health endpoints require tokens:

```txt
services:
    PaymentAPI is an API at "https://api.payments.example.com"
        with headers:
            Authorization: "Bearer {env.PAYMENT_API_KEY}"
```
