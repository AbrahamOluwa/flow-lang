# Webhook Server

A webhook is a way for one system to automatically notify another system when something happens. Flow can turn any workflow into a webhook endpoint — meaning other systems can trigger your workflow by sending it a web request.

For example, you could:
- Have Stripe trigger your workflow when a payment is received
- Have GitHub trigger your workflow when code is pushed
- Have a form on your website trigger your workflow when submitted

## Starting the server

### Serving a single workflow

```bash
flow serve my-workflow.flow
```

This starts a server on your computer (port 3000 by default). Your workflow is now listening for incoming requests.

### Serving multiple workflows

If you have a folder with multiple `.flow` files, you can serve them all at once:

```bash
flow serve ./workflows/
```

Each file automatically gets its own address based on its filename:
- `workflows/email-verification.flow` becomes available at `/email-verification`
- `workflows/order-processing.flow` becomes available at `/order-processing`

### Options

| Option | What it does | Example |
|---|---|---|
| `--port` | Changes which port the server listens on | `--port 4000` |
| `--verbose` | Shows details about each incoming request | `--verbose` |
| `--mock` | Uses simulated services instead of real ones | `--mock` |

```bash
flow serve my-workflow.flow --port 4000 --verbose --mock
```

## Triggering a workflow

Send a web request with JSON data. The simplest way is with `curl` in your terminal:

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"username": "octocat"}'
```

The JSON data you send becomes the `request` object in your workflow. So in this example, `request.username` would equal `"octocat"`.

You can also use tools like [Postman](https://www.postman.com/) or any programming language's HTTP library to send requests.

## What comes back

### When the workflow completes successfully

```json
{
    "status": "completed",
    "outputs": {
        "name": "The Octocat",
        "followers": 21724,
        "popularity": "star"
    }
}
```

The `outputs` contain whatever your workflow produces with `complete with`. HTTP status: **200** (success).

### When the workflow rejects

If your workflow uses `reject with`, the response looks like:

```json
{
    "status": "rejected",
    "message": "The email address could not be verified"
}
```

HTTP status: **400** (client error).

### When something goes wrong

If an unexpected error occurs during execution:

```json
{
    "status": "error",
    "message": "Cannot subtract text from number"
}
```

HTTP status: **500** (server error).

## Built-in endpoints

Every Flow server comes with a couple of helpful endpoints:

### Health check

A simple way to check if the server is running:

```bash
curl http://localhost:3000/health
```

Returns: `{ "status": "ok" }`

### Workflow info

See what workflows are available:

```bash
curl http://localhost:3000
```

**Single file mode** returns the workflow's details:

```json
{
    "name": "GitHub Repository Scout",
    "version": 1,
    "trigger": "when a username is provided"
}
```

**Directory mode** returns a list of all available workflows:

```json
{
    "workflows": [
        {
            "name": "Email Verification",
            "route": "/email-verification",
            "trigger": "when a form is submitted"
        }
    ]
}
```

## Error checking at startup

Flow validates all your workflow files when the server starts. If any file has an error, the server won't start — it will show you exactly what's wrong so you can fix it first. This means once the server is running, you can be confident that all your workflows are properly written.

## Testing mode

Use `--mock` during development to test your webhook setup without calling real services:

```bash
flow serve my-workflow.flow --mock
```

This is great for:
- Testing that your webhook integration works correctly
- Developing without needing API keys
- Making sure the request and response formats are right

## Complete example

Here's a GitHub Scout workflow served as a webhook:

```txt
config:
    name: "GitHub Repository Scout"
    version: 1

services:
    GitHub is an API at "https://api.github.com"

workflow:
    trigger: when a username is provided

    step FetchProfile:
        get profile using GitHub at "/users/{request.username}"
            save the result as profile
        set name to profile.name
        set followers to profile.followers

    step Evaluate:
        if followers is above 1000:
            set popularity to "star"
        otherwise:
            set popularity to "newcomer"

    complete with name name and popularity popularity
```

Start the server:

```bash
flow serve github-scout.flow --verbose
```

Trigger it:

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"username": "torvalds"}'
```

Response:

```json
{
    "status": "completed",
    "outputs": {
        "name": "Linus Torvalds",
        "popularity": "star"
    }
}
```

## Next steps

- [CLI Commands](/reference/cli) — All available commands and options
- [Services](/guide/services) — Connect to external services
- [Examples](/examples/) — More workflow examples
