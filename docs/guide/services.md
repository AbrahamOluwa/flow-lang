# Services

Services are the external systems your workflow talks to — things like APIs (web services), AI models, and plugins. Think of them as the tools your workflow uses to get things done.

For example, if your workflow needs to look up a GitHub user, you'd declare GitHub as a service and then use it in your workflow.

## Declaring services

Before using a service, you need to declare it at the top of your file in the `services:` block. This tells Flow what the service is called, what type it is, and where to find it:

```txt
services:
    GitHub is an API at "https://api.github.com"
    Stripe is a plugin "stripe-payments"
    Analyst is an AI using "openai/gpt-4o"
```

Each service declaration has three parts:
- **A name** — what you'll call it in your workflow (e.g., `GitHub`, `Stripe`)
- **A type** — what kind of service it is (`API`, `webhook`, `plugin`, `AI`, or `database`)
- **A location** — the URL, plugin name, AI model, or database file path

You can also declare **webhooks** — services that always receive data via POST:

```txt
services:
    SlackNotifier is a webhook at "https://hooks.slack.com/services/..."
```

You can also declare **databases** — SQLite databases that your workflow can query and modify:

```txt
services:
    DB is a database at "./inventory.sqlite"
```

## Using a service in your workflow

To call a service, describe what you want to do in plain English, then say `using` followed by the service name:

```txt
get profile using GitHub at "/users/octocat"
    save the result as profile
```

This says: "Get a profile from GitHub at the path `/users/octocat`, and save what comes back as `profile`."

### What the action word means

The first word of your service call tells Flow what kind of action to take:

| What you write | What it does |
|---|---|
| `get` or `fetch` | Retrieves data (doesn't change anything) |
| `create` or `send` | Sends new data to the service |
| `update` or `modify` | Changes existing data |
| `delete` or `remove` | Removes data |

For example:
- `get profile using GitHub` — retrieves data
- `create order using Stripe` — sends new data
- `delete record using Database` — removes data

### Adding a path

Many services have different endpoints (think of them as different "pages" you can visit). Use `at` to specify which one:

```txt
services:
    GitHub is an API at "https://api.github.com"

workflow:
    # This calls: https://api.github.com/users/octocat
    get profile using GitHub at "/users/octocat"
        save the result as profile
```

You can include variables in the path using curly braces:

```txt
get profile using GitHub at "/users/{request.username}"
    save the result as profile
```

### Sending data to a service

Use `with` to send additional data along with your request:

```txt
create order using Stripe with amount total and currency "usd"
```

This sends two pieces of data: the `amount` (from a variable called `total`) and the `currency` (the text `"usd"`).

### Saving what comes back

When a service responds, you usually want to save the result so you can use it later. Add `save the result as` on the next line (indented):

```txt
get profile using GitHub at "/users/octocat"
    save the result as profile

# Now you can use the data:
set name to profile.name
set followers to profile.followers
log "Found: {name} with {followers} followers"
```

## Adding HTTP headers

Most real APIs require authentication. You can add custom headers to any API or webhook service using `with headers:`:

```txt
services:
    GitHub is an API at "https://api.github.com"
        with headers:
            Authorization: "token {env.GITHUB_TOKEN}"
            Accept: "application/vnd.github.v3+json"
            User-Agent: "flow-lang"
```

The `with headers:` block goes directly below the service declaration, indented one level deeper. Each header is a name followed by a colon and a value.

Header values support **string interpolation** — use curly braces to insert environment variables:

```txt
services:
    Stripe is an API at "https://api.stripe.com/v1"
        with headers:
            Authorization: "Bearer {env.STRIPE_SECRET_KEY}"
```

Headers are resolved once when the workflow starts (after environment variables are loaded), and sent with every request to that service.

## Checking the response status

After calling a service, you might want to check whether the request returned a `200 OK` or a `201 Created`. Use `save the status as` to capture the HTTP status code:

```txt
create item using API with name "widget"
    save the result as item
    save the status as status-code

if status-code is 201:
    log "Item created successfully"
otherwise:
    log "Something unexpected happened (status: {status-code})"
```

The status code is saved as a number (e.g., `200`, `201`, `404`). When using mock services, the status will be `empty` since mock connectors don't return real HTTP data.

## Reading response headers

Some APIs return useful information in their response headers — things like rate limits, pagination links, or request IDs. Use `save the response headers as` to capture them:

```txt
get repos using GitHub at "/user/repos"
    save the result as repos
    save the response headers as resp-headers

log "Rate limit remaining: {resp-headers.x-ratelimit-remaining}"
log "Request ID: {resp-headers.x-request-id}"
```

Response headers are saved as a record with text values, accessible via dot notation. You can use all three save clauses together:

```txt
get data using API at "/items"
    save the result as data
    save the status as status-code
    save the response headers as resp-headers
```

## Handling errors

Sometimes services fail — the internet goes down, or the service is temporarily unavailable. You can handle this gracefully:

```txt
charge payment using Stripe with amount total
    on failure:
        retry 3 times waiting 5 seconds
        if still failing:
            reject with "Payment failed. Please try again."
```

This says: "If the payment fails, try again up to 3 times with a 5-second pause between each attempt. If it still doesn't work, stop the workflow and show this error message."

The wait is real — Flow actually pauses for the specified duration between retries. You can use seconds or minutes:

```txt
    on failure:
        retry 3 times waiting 30 seconds

    on failure:
        retry 2 times waiting 1 minutes
```

## Using secret keys

Many services require a secret key (sometimes called an API key) to verify your identity. You should never put these directly in your Flow file. Instead, use environment variables:

1. Create a `.env` file in your project folder:
   ```
   GITHUB_TOKEN=your-secret-key-here
   STRIPE_KEY=sk_live_your-key-here
   ```

2. Access them in your workflow with `env.`:
   ```txt
   set api-key to env.GITHUB_TOKEN
   ```

The `.env` file stays on your computer and should never be shared or uploaded to the internet.

## Databases

Flow supports two database engines: **SQLite** for local development and simple apps, and **PostgreSQL** for production workloads. The connector is selected automatically based on the connection string.

### SQLite

Declare a SQLite database service with the path to a `.sqlite` file:

```txt
services:
    DB is a database at "./inventory.sqlite"
```

Use `:memory:` for an in-memory database (useful for testing):

```txt
services:
    TestDB is a database at ":memory:"
```

### PostgreSQL

For production databases, use a PostgreSQL connection string. Flow detects URLs starting with `postgresql://` or `postgres://` and uses the PostgreSQL connector automatically:

```txt
services:
    ProdDB is a database at "postgresql://user:password@localhost:5432/mydb"
```

The `pg` npm package is required for PostgreSQL. Install it with:

```bash
npm install pg
```

::: tip Same syntax, different engine
The query syntax is identical for SQLite and PostgreSQL. Switch between them by changing only the connection string — no workflow changes needed.
:::

You can use environment variables for the connection string to keep credentials out of your `.flow` files:

```txt
services:
    DB is a database at "postgresql://localhost:5432/mydb"
```

Then set the database URL in your `.env` file or environment.

### Querying data

Use `at` to specify the table name, and `with` to filter:

```txt
get product using DB at "products" with id 42
    save the result as product

list orders using DB at "orders" with status "active"
    save the result as active-orders
```

The action word determines what kind of query runs:

| What you write | What happens |
|---|---|
| `get`, `fetch`, `find` | Returns a single row |
| `list`, `search`, `query` | Returns all matching rows |
| `count` | Returns the number of matching rows |
| `insert`, `create`, `add` | Inserts a new row |
| `update`, `modify` | Updates existing rows |
| `delete`, `remove` | Deletes matching rows |

### Inserting data

```txt
insert record using DB at "audit_log" with action "login" and user_id user-id
    save the result as entry
```

The result contains the `id` of the new row.

### Updating data

The `id` parameter specifies which row to update. All other parameters become the new values:

```txt
update record using DB at "users" with id user-id and status "verified"
    save the result as result
```

### Deleting data

```txt
delete record using DB at "sessions" with expired true
    save the result as result
```

### Raw SQL

For complex queries, use the `query` parameter to write SQL directly:

```txt
run query using DB with query "SELECT COUNT(*) as total FROM orders WHERE date > :date" and date "2024-01-01"
    save the result as stats
```

Additional parameters (like `date` above) become named bindings in the SQL — they are never concatenated into the query, so SQL injection is prevented.

### Empty results

When a `get` query finds no matching rows, the result is `empty`. Use `is empty` to check:

```txt
get user using DB at "users" with email request.email
    save the result as user

if user is empty:
    reject with "User not found"
```

### PostgreSQL example

Here's a real-world workflow that queries a PostgreSQL database to look up a customer and classify them into a loyalty tier:

```txt
services:
    DB is a database at "postgresql://localhost:5432/customers"

workflow:
    trigger: when a customer lookup is requested

    get customer using DB at "customers" with email request.email
        save the result as customer

    if customer is empty:
        reject with "Customer not found"

    list orders using DB at "orders" with customer_id customer.id
        save the result as orders

    set total-spent to 0
    for each order in orders:
        set total-spent to total-spent plus order.amount

    if total-spent is above 10000:
        set tier to "platinum"
    otherwise if total-spent is above 5000:
        set tier to "gold"
    otherwise:
        set tier to "standard"

    complete with name customer.name and tier tier and total-spent total-spent
```

## Next steps

- [AI Integration](/guide/ai-integration) — Use AI models as services
- [Webhook Server](/guide/webhook-server) — Make your workflows available as web endpoints
- [Scheduling](/guide/scheduling) — Run workflows on a recurring schedule
- [Examples](/examples/) — See services used in real workflows
