# CLI Commands

Flow provides four commands for working with your workflows.

## flow check

Validate a workflow file without running it.

```bash
flow check <file>
```

Checks for:
- Syntax errors (typos, bad indentation)
- Undefined variables
- Unknown services
- Duplicate step names

**Example:**

```bash
flow check my-workflow.flow
```

```
my-workflow.flow is valid — no errors found.
```

If there are errors:

```
Error in my-workflow.flow, line 12:

    verify the email using EmailChecker

    I don't know what "EmailChecker" is. You haven't declared it
    in your services block.

    Did you mean "EmailVerifier"?

    Hint: Every service must be declared at the top of your file:
        services:
            EmailChecker is an API at "https://..."
```

## flow run

Execute a workflow.

```bash
flow run <file> [options]
```

### Options

| Option | Description |
|---|---|
| `--input <json>` | JSON string to use as the `request` object |
| `--verbose` | Show detailed execution logs |
| `--strict-env` | Fail if any referenced `env` variables are missing |
| `--mock` | Use mock services instead of real connectors |

### Examples

```bash
# Run with input data
flow run hello.flow --input '{"name": "Alice"}'

# Run with verbose output
flow run hello.flow --input '{"name": "Alice"}' --verbose

# Run with mock services (no real API calls)
flow run hello.flow --mock --input '{"name": "test"}'

# Require all env variables to be set
flow run my-workflow.flow --strict-env
```

::: tip Windows users
Windows CMD and PowerShell handle quotes differently. Use escaped double quotes instead:
```bash
flow run hello.flow --input "{\"name\": \"Alice\"}"
```
:::

### Input format

The `--input` option accepts a JSON string. The data becomes available as the `request` object in your workflow:

```bash
flow run hello.flow --input '{"username": "octocat", "limit": 10}'
```

```txt
# In your workflow:
set user to request.username    # "octocat"
set max to request.limit        # 10
```

## flow test

Run a workflow in test mode with mock services.

```bash
flow test <file> [options]
```

### Options

| Option | Description |
|---|---|
| `--dry-run` | Show what would happen without executing |
| `--verbose` | Show detailed execution logs |

### Examples

```bash
# Test with mock services
flow test my-workflow.flow

# Dry run — show execution plan
flow test my-workflow.flow --dry-run --verbose
```

Test mode automatically uses mock connectors, so no real API calls are made.

## flow serve

Start an HTTP server to trigger workflows via webhook.

```bash
flow serve <target> [options]
```

`<target>` can be a single `.flow` file or a directory containing `.flow` files.

### Options

| Option | Description |
|---|---|
| `--port <number>` | Port to listen on (default: 3000) |
| `--verbose` | Log each incoming request |
| `--mock` | Use mock services instead of real connectors |

### Examples

```bash
# Serve a single workflow
flow serve my-workflow.flow

# Serve all workflows in a directory
flow serve ./workflows/

# Custom port with verbose logging
flow serve my-workflow.flow --port 4000 --verbose

# Mock mode for development
flow serve my-workflow.flow --mock
```

### Routes

**Single file:** The workflow is available at `POST /`.

**Directory:** Each `.flow` file becomes a route based on its filename:
- `email-verification.flow` → `POST /email-verification`
- `order-processing.flow` → `POST /order-processing`

### Built-in endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check — returns `{ "status": "ok" }` |
| `/` | GET | Workflow metadata or list of workflows |
| `/` | POST | Execute workflow (single file) |
| `/:workflow` | POST | Execute specific workflow (directory) |

### Triggering workflows

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"username": "octocat"}'
```

::: tip Windows users
On Windows, use escaped double quotes for JSON:
```bash
curl -X POST http://localhost:3000 -H "Content-Type: application/json" -d "{\"username\": \"octocat\"}"
```
:::

The JSON body becomes the `request` object in the workflow.

## Environment variables

Flow reads `.env` files automatically from the current directory. You can also set environment variables in your shell:

```bash
export API_KEY=your-key-here
flow run my-workflow.flow
```

Access them in your workflow with `env.VARIABLE_NAME`.
