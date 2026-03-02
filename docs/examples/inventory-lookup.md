# Inventory Lookup

Queries a SQLite database to check product stock levels and reports whether inventory is sufficient or running low.

## Full source

```txt
config:
    name: "Inventory Lookup"
    version: 1

services:
    DB is a database at "./inventory.sqlite"

workflow:
    trigger: when a stock check is requested

    step CheckProduct:
        get product using DB at "products" with id request.product-id
            save the result as product

        if product is empty:
            reject with "Product not found"

        log "Found product: {product.name}"

    step EvaluateStock:
        if product.stock is below 10:
            log "LOW STOCK WARNING: {product.name} has only {product.stock} units"
            complete with status "low-stock" and product-name product.name and stock product.stock

        otherwise:
            log "Stock level OK: {product.name} has {product.stock} units"
            complete with status "in-stock" and product-name product.name and stock product.stock
```

## What this does

1. **Declares a database service** — `DB is a database at "./inventory.sqlite"` connects to a local SQLite file
2. **Queries a single row** — `get product using DB at "products"` auto-generates a `SELECT * FROM products WHERE id = :id LIMIT 1`
3. **Handles missing data** — if the query returns no rows, `product` is empty and the workflow rejects
4. **Reads fields from the result** — `product.name` and `product.stock` access columns from the returned row
5. **Evaluates stock level** — compares `product.stock` against a threshold using `is below`
6. **Completes with status** — returns either `"low-stock"` or `"in-stock"` along with the product details

## Concepts demonstrated

- **Database service type** — `is a database at "path"` backed by SQLite via `better-sqlite3`
- **Table mode queries** — `at "tablename"` with `with` params auto-generates SQL (no raw SQL needed)
- **Verb-to-operation mapping** — `get` maps to `SELECT ... LIMIT 1`, returning a single record or empty
- **Empty checks** — `if product is empty:` handles the case where no database row matched
- **Dot access on query results** — `product.name`, `product.stock` read columns from the returned record
- **Multiple outputs** — `complete with status ... and product-name ... and stock ...`

## Running it

```bash
# Test with mock services (no database needed)
flow run examples/inventory-lookup.flow --mock \
  --input '{"request": {"product-id": 1}}'

# Run with a real SQLite database
flow run examples/inventory-lookup.flow \
  --input '{"request": {"product-id": 42}}'
```

## Database setup

For real execution, create the SQLite database first:

```bash
sqlite3 inventory.sqlite <<'SQL'
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    stock INTEGER DEFAULT 0
);
INSERT INTO products (name, stock) VALUES ('Widget', 100);
INSERT INTO products (name, stock) VALUES ('Gadget', 3);
INSERT INTO products (name, stock) VALUES ('Doohickey', 50);
SQL
```

## As a webhook

```bash
flow serve examples/inventory-lookup.flow --mock

curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"request": {"product-id": 1}}'
```
