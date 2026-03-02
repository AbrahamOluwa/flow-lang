# Customer Database Lookup

This workflow demonstrates querying a PostgreSQL database to look up customer information, aggregate order history, and classify customers into loyalty tiers based on spending.

## What it does

1. **Finds the customer** — Looks up a customer record by email address
2. **Gets order history** — Retrieves all orders for that customer
3. **Calculates spending** — Loops through orders to sum total spend
4. **Classifies loyalty tier** — Assigns platinum, gold, silver, or bronze based on spending
5. **Checks activity** — Counts recent orders to determine if the customer is active

## Key concepts

- **PostgreSQL database** — Uses `postgresql://` connection string for production databases
- **Loops with accumulators** — `for each` loop to calculate running totals
- **Empty checks** — Handles the case when a customer is not found
- **Tiered conditionals** — Multi-level `if/otherwise if/otherwise` for classification

## The workflow

```txt
config:
    name: "Customer Database Lookup"
    version: 1

services:
    DB is a database at "postgresql://localhost:5432/customers"

workflow:
    trigger: when a customer lookup is requested

    set email to request.customer_email
    log "Looking up customer: {email}"

    step FindCustomer:
        get customer using DB at "customers" with email email
            save the result as customer

        if customer is empty:
            reject with "No customer found with email: {email}"

        set customer-id to customer.id
        set name to customer.name
        log "Found customer: {name} (ID: {customer-id})"

    step GetOrderHistory:
        list orders using DB at "orders" with customer_id customer-id
            save the result as orders

        set total-spent to 0
        set order-count to 0

        for each order in orders:
            set total-spent to total-spent plus order.amount
            set order-count to order-count plus 1

        log "Customer has {order-count} orders totaling {total-spent}"

    step ClassifyLoyalty:
        if total-spent is above 10000:
            set tier to "platinum"
            set discount to 20
        otherwise if total-spent is above 5000:
            set tier to "gold"
            set discount to 15
        otherwise if total-spent is above 1000:
            set tier to "silver"
            set discount to 10
        otherwise:
            set tier to "bronze"
            set discount to 5

        log "Loyalty tier: {tier} ({discount}% discount)"

    step CheckRecentActivity:
        count recent using DB at "orders" with customer_id customer-id
            save the result as recent-count

        if recent-count is 0:
            set activity to "inactive"
            log "Warning: customer has no recent orders"
        otherwise if recent-count is above 5:
            set activity to "highly active"
        otherwise:
            set activity to "active"

    complete with name name and email email and tier tier and discount discount and total-spent total-spent and order-count order-count and activity activity
```

## Running it

### With mock services (no database needed)

```bash
flow test examples/customer-db.flow --verbose
```

### With real PostgreSQL

Set up your database connection in a `.env` file, then:

```bash
flow run examples/customer-db.flow --input '{"customer_email": "ada@example.com"}'
```

### As a webhook

```bash
flow serve examples/customer-db.flow --mock --cors
```

Then trigger it:

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"customer_email": "ada@example.com"}'
```

## Switching between SQLite and PostgreSQL

The workflow above uses PostgreSQL. To use a local SQLite database instead, just change the connection string:

```txt
services:
    DB is a database at "./customers.sqlite"
```

Everything else stays the same — the query syntax is identical.
