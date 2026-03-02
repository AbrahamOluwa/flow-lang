# Payment Reconciliation

Batch reconciliation that compares ledger records against payment processor settlements, detects mismatches, and uses AI to analyze discrepancies.

## Full source

```txt
# Payment Reconciliation
# Compares ledger records against payment processor settlements,
# detects mismatches, uses AI to analyze discrepancies, and notifies finance ops.

config:
    name: "Payment Reconciliation"
    version: 1
    description: "Batch reconciliation with loop totals and AI discrepancy analysis"
    timeout: 5 minutes

services:
    Ledger is an API at "https://ledger.example.com/api"
    Processor is an API at "https://processor.example.com/api"
        with headers:
            Authorization: "Bearer {env.PROCESSOR_API_KEY}"
    Analyst is an AI using "anthropic/claude-sonnet-4-20250514"
    FinanceOps is a webhook at "https://hooks.slack.com/services/finance-ops"
    ReconciliationDB is an API at "https://reconciliation.example.com/api"

workflow:
    trigger: when a reconciliation batch is submitted

    set batch-id to reconciliation.batch_id
    set report-date to reconciliation.date
    set ledger-total to reconciliation.ledger_total
    set ledger-count to reconciliation.ledger_count
    set settlements to reconciliation.settlements
    log "Reconciliation started for batch {batch-id} on {report-date}"

    # --------------------------------------------------------
    # Step 1: Validate the reconciliation request
    # --------------------------------------------------------
    step ValidateRequest:
        if batch-id is empty:
            reject with "Missing batch ID"
        if report-date is empty:
            reject with "Missing report date"
        if ledger-total is empty:
            reject with "Missing ledger total"
        log "Request validated: batch {batch-id}, ledger total {ledger-total}"

    # --------------------------------------------------------
    # Step 2: Fetch records from both sources
    # --------------------------------------------------------
    step FetchRecords:
        fetch ledger entries using Ledger with batch batch-id and date report-date
            save the result as ledger-data
            on failure:
                retry 2 times waiting 3 seconds
                if still failing:
                    log "Ledger service unavailable"
                    reject with "Could not reach ledger service"

        fetch processor settlements using Processor at "/settlements/{batch-id}"
            save the result as processor-data
            on failure:
                retry 2 times waiting 3 seconds
                if still failing:
                    log "Processor service unavailable"
                    reject with "Could not reach payment processor"

        log "Records fetched from both sources"

    # --------------------------------------------------------
    # Step 3: Calculate settlement totals using loop
    # --------------------------------------------------------
    step CalculateTotals:
        set settlement-total to 0
        set settlement-count to 0

        for each settlement in settlements:
            set settlement-total to settlement-total plus settlement.amount
            set settlement-count to settlement-count plus 1
            log "Settlement {settlement.id}: {settlement.amount} ({settlement.status})"

        log "Settlement total: {settlement-total}, count: {settlement-count}"

    # --------------------------------------------------------
    # Step 4: Compare ledger vs processor results
    # --------------------------------------------------------
    step CompareResults:
        set total-difference to ledger-total minus settlement-total
        set count-difference to ledger-count minus settlement-count

        if total-difference is not 0:
            set has-mismatch to true
            log "Total difference: {total-difference} (ledger: {ledger-total}, settlements: {settlement-total})"
        otherwise:
            set has-mismatch to false
            log "Totals match: {ledger-total}"

        if count-difference is not 0:
            set has-mismatch to true
            log "Count difference: {count-difference} (ledger: {ledger-count}, settlements: {settlement-count})"
        otherwise:
            log "Counts match: {ledger-count}"

    # --------------------------------------------------------
    # Step 5: Analyze discrepancies with AI if mismatch found
    # --------------------------------------------------------
    step AnalyzeDiscrepancies:
        if has-mismatch is true:
            ask Analyst to "analyze the reconciliation discrepancy between ledger total and settlement total, identify likely causes and recommend next steps"
                save the result as analysis
                save the confidence as analysis-confidence
            log "AI analysis complete, confidence: {analysis-confidence}"

            notify finance team using FinanceOps with batch batch-id and date report-date and total-difference total-difference and count-difference count-difference and analysis analysis
                on failure:
                    retry 1 times waiting 5 seconds
                    if still failing:
                        log "WARNING: Could not notify finance ops"
            log "Finance ops notified of discrepancy"
        otherwise:
            set analysis to "No discrepancies found"
            set analysis-confidence to 1
            log "No discrepancies to analyze"

    # --------------------------------------------------------
    # Step 6: Record reconciliation result
    # --------------------------------------------------------
    step RecordResult:
        record reconciliation using ReconciliationDB with batch batch-id and date report-date and ledger-total ledger-total and settlement-total settlement-total and mismatch has-mismatch and analysis analysis
        log "Reconciliation recorded for batch {batch-id}"

    complete with batch batch-id and date report-date and mismatch has-mismatch and ledger-total ledger-total and settlement-total settlement-total and analysis analysis
```

## What this does

1. **Validates the request** — checks that batch ID, report date, and ledger total are present
2. **Fetches records** — retrieves ledger entries and processor settlement data with retry logic
3. **Calculates settlement totals** — loops through each settlement record, accumulating the total amount and count
4. **Compares results** — uses `minus` arithmetic to find the difference between ledger and settlement totals, flagging mismatches
5. **Analyzes discrepancies** — when a mismatch is found, asks AI to analyze the discrepancy and notifies the finance ops team
6. **Records the result** — saves the reconciliation outcome to the database

## Concepts demonstrated

- **Batch processing with loops** — `for each settlement in settlements:` with running totals using `plus`
- **Arithmetic comparison** — `set total-difference to ledger-total minus settlement-total`
- **Boolean flags** — `set has-mismatch to true` for conditional branching
- **Conditional AI invocation** — AI analysis only runs when a mismatch is detected
- **Authenticated headers** — `with headers:` block with env var interpolation on Processor
- **Multi-source data fetching** — parallel retrieval from Ledger and Processor APIs
- **Webhook notifications** — alerting finance ops with retry on failure

## Running it

```bash
# Test with mock services (no API keys needed)
flow run examples/payment-reconciliation.flow --mock \
  --input '{"reconciliation": {"batch_id": "BATCH-001", "date": "2024-03-01", "ledger_total": 5700, "ledger_count": 2, "settlements": [{"id": "SET-001", "amount": 2500, "status": "cleared"}, {"id": "SET-002", "amount": 3200, "status": "cleared"}]}}'

# Run with real services (requires env vars)
export ANTHROPIC_API_KEY=sk-ant-...
export PROCESSOR_API_KEY=proc_...
flow run examples/payment-reconciliation.flow \
  --input '{"reconciliation": {"batch_id": "BATCH-001", "date": "2024-03-01", "ledger_total": 5700, "ledger_count": 2, "settlements": [{"id": "SET-001", "amount": 2500, "status": "cleared"}, {"id": "SET-002", "amount": 3200, "status": "cleared"}]}}'
```

## As a webhook

```bash
flow serve examples/payment-reconciliation.flow --mock

curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"reconciliation": {"batch_id": "BATCH-001", "date": "2024-03-01", "ledger_total": 5700, "ledger_count": 2, "settlements": [{"id": "SET-001", "amount": 2500, "status": "cleared"}, {"id": "SET-002", "amount": 3200, "status": "cleared"}]}}'
```
