# Scheduling

Flow can run workflows on a recurring schedule, so you don't need external tools like cron, Task Scheduler, or a cloud-based scheduler. Just tell Flow how often to run, and it handles the rest.

Common use cases:
- Run a daily sales report every evening
- Check service health every 5 minutes
- Send a weekly summary every Monday morning
- Process a batch of records every hour

## Starting a scheduled workflow

### Human-readable schedules

Use `--every` with plain English to describe how often the workflow should run:

```bash
flow schedule my-report.flow --every "5 minutes"
```

Flow converts your description into a schedule and starts running. Press **Ctrl+C** to stop.

### Cron expressions

If you prefer standard cron syntax, use `--cron`:

```bash
flow schedule my-report.flow --cron "*/5 * * * *"
```

The cron format is: `minute hour day-of-month month day-of-week`.

## Schedule formats

The `--every` option understands these formats:

| What you write | When it runs |
|---|---|
| `"5 minutes"` | Every 5 minutes |
| `"30 minutes"` | Every 30 minutes |
| `"1 hour"` | Every hour, on the hour |
| `"2 hours"` | Every 2 hours |
| `"hour"` | Every hour, on the hour |
| `"day"` | Once a day at midnight |
| `"day at 9:00"` | Once a day at 9:00 AM |
| `"day at 18:00"` | Once a day at 6:00 PM |
| `"monday"` | Every Monday at midnight |
| `"monday at 9:00"` | Every Monday at 9:00 AM |
| `"friday at 17:30"` | Every Friday at 5:30 PM |

Day names can be full (`monday`, `tuesday`) or abbreviated (`mon`, `tue`). Everything is case-insensitive.

## Options

| Option | What it does | Example |
|---|---|---|
| `--every <description>` | Human-readable schedule | `--every "5 minutes"` |
| `--cron <expression>` | Standard cron expression | `--cron "0 9 * * 1"` |
| `--input <json>` | JSON data passed to each run | `--input '{"region": "us-east"}'` |
| `--input-file <path>` | Read input from a file | `--input-file config.json` |
| `--mock` | Use mock services | `--mock` |
| `--verbose` | Show detailed output for each run | `--verbose` |
| `--output-log <dir>` | Write a JSON log file for each run | `--output-log ./logs/` |

You must provide either `--every` or `--cron`. If neither is given, Flow will show an error.

## Logging

When you use `--output-log`, Flow writes a separate JSON log file for each execution, with a timestamp in the filename:

```bash
flow schedule my-report.flow --every "hour" --output-log ./logs/
```

This creates files like:
```
logs/
    2026-03-02T09-00-00-000Z.json
    2026-03-02T10-00-00-000Z.json
    2026-03-02T11-00-00-000Z.json
```

Each file contains the full execution result, outputs, and log entries — the same structured log format used by `flow run --output-log`.

## Examples

### Daily sales report

Aggregate sales data and send a Slack notification every day at 6 PM:

```bash
flow schedule examples/daily-sales-report.flow \
  --every "day at 18:00" \
  --verbose
```

### Service health monitoring

Check if critical APIs are responding every 5 minutes:

```bash
flow schedule examples/sla-monitor.flow \
  --every "5 minutes" \
  --output-log ./logs/health/ \
  --verbose
```

### Weekly report with cron

Run a report every Monday at 9 AM using cron syntax:

```bash
flow schedule my-report.flow --cron "0 9 * * 1" --verbose
```

## Graceful shutdown

Press **Ctrl+C** (or send SIGTERM) to stop the scheduler cleanly. Flow will:
1. Stop scheduling new runs
2. Print how many runs completed
3. Exit with code 0

```
^C
Stopping scheduler...
Completed 12 runs.
```

## Validation at startup

When you start a scheduled workflow, Flow validates the `.flow` file immediately — before the first run. If there are syntax errors or undefined services, you'll see the errors right away instead of discovering them on the first scheduled execution.

## Next steps

- [CLI Commands](/reference/cli) — All available commands and options
- [Webhook Server](/guide/webhook-server) — Serve workflows as HTTP endpoints
- [Examples](/examples/) — See scheduling in action
