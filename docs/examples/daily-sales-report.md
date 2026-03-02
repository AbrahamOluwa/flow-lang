# Daily Sales Report

This workflow aggregates sales data from a database, calculates revenue metrics, evaluates performance against targets, and sends a summary notification to Slack. It's designed to run on a daily schedule.

## What it does

1. **Fetches completed sales** — Queries the database for all completed sales
2. **Calculates totals** — Loops through sales to compute revenue, count, and highest sale
3. **Computes averages** — Calculates average order value
4. **Evaluates performance** — Compares revenue against targets (exceptional / strong / average / below)
5. **Sends Slack notification** — Posts a formatted summary to the team channel

## Key concepts

- **Scheduling** — Designed for `flow schedule --every "day at 18:00"`
- **Database queries** — Lists records and aggregates with loops
- **Math operations** — Division and rounding for averages
- **Webhook notifications** — Sends a Slack message with retry logic

## The workflow

```txt
config:
    name: "Daily Sales Report"
    version: 1

services:
    DB is a database at "postgresql://localhost:5432/sales"
    Slack is a webhook at "https://hooks.slack.com/services/placeholder"

workflow:
    trigger: when the end-of-day report runs

    log "Generating daily sales report"

    step FetchSales:
        list sales using DB at "sales" with status "completed"
            save the result as sales

        set total-revenue to 0
        set order-count to 0
        set highest-sale to 0

        for each sale in sales:
            set total-revenue to total-revenue plus sale.amount
            set order-count to order-count plus 1
            if sale.amount is above highest-sale:
                set highest-sale to sale.amount

        log "Found {order-count} completed sales"

    step CalculateMetrics:
        if order-count is above 0:
            set average-order to total-revenue divided by order-count
            set average-order to average-order times 1 rounded to 2
        otherwise:
            set average-order to 0

        log "Revenue: {total-revenue}, Average: {average-order}, Highest: {highest-sale}"

    step EvaluatePerformance:
        if total-revenue is above 50000:
            set performance to "exceptional"
            set summary to "Outstanding day! Revenue exceeded 50k target."
        otherwise if total-revenue is above 25000:
            set performance to "strong"
            set summary to "Good day. Revenue above 25k baseline."
        otherwise if total-revenue is above 10000:
            set performance to "average"
            set summary to "Standard day. Revenue meets minimum threshold."
        otherwise:
            set performance to "below target"
            set summary to "Below target. Review may be needed."

    step NotifyTeam:
        set message to "Daily Sales Report: {order-count} orders, {total-revenue} revenue ({performance}). {summary}"
        send alert using Slack with text message
            on failure:
                retry 2 times waiting 10 seconds
                if still failing:
                    log "Could not reach Slack"

    complete with total-revenue total-revenue and order-count order-count and average-order average-order and highest-sale highest-sale and performance performance
```

## Running it

### One-time run with mock services

```bash
flow test examples/daily-sales-report.flow --verbose
```

### On a daily schedule

Run every day at 6 PM:

```bash
flow schedule examples/daily-sales-report.flow --every "day at 18:00" --mock --verbose
```

### With logging

Write a log file for each execution:

```bash
flow schedule examples/daily-sales-report.flow \
  --every "day at 18:00" \
  --output-log ./logs/sales/ \
  --verbose
```

### As a webhook (triggered externally)

```bash
flow serve examples/daily-sales-report.flow --mock --cors
```

## Adapting for your use case

**Change the database:** Replace the PostgreSQL connection string with your database URL or a SQLite path:

```txt
services:
    DB is a database at "./sales.sqlite"
```

**Change the schedule:** Adjust the timing:

```bash
flow schedule report.flow --every "hour"           # Every hour
flow schedule report.flow --every "monday at 9:00"  # Weekly on Monday
flow schedule report.flow --cron "0 */6 * * *"      # Every 6 hours
```

**Change the notification target:** Replace Slack with any webhook (Discord, Teams, PagerDuty):

```txt
services:
    Teams is a webhook at "https://outlook.office.com/webhook/..."
```
