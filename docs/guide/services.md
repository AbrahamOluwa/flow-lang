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
- **A type** — what kind of service it is (`API`, `plugin`, or `AI`)
- **A location** — the URL, plugin name, or AI model to use

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

## Handling errors

Sometimes services fail — the internet goes down, or the service is temporarily unavailable. You can handle this gracefully:

```txt
charge payment using Stripe with amount total
    on failure:
        retry 3 times waiting 5 seconds
        if still failing:
            reject with "Payment failed. Please try again."
```

This says: "If the payment fails, try again up to 3 times with a 5-second pause between attempts. If it still doesn't work, stop the workflow and show this error message."

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

## Next steps

- [AI Integration](/guide/ai-integration) — Use AI models as services
- [Webhook Server](/guide/webhook-server) — Make your workflows available as web endpoints
- [Examples](/examples/) — See services used in real workflows
