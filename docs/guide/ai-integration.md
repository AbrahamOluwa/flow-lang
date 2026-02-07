# AI Integration

Flow lets you use AI models (like ChatGPT or Claude) directly in your workflows. You give the AI instructions in plain English, and it sends back a response that you can use in your logic.

This is useful for tasks like:
- Classifying support tickets ("Is this urgent or not?")
- Summarizing long text
- Generating email responses
- Making decisions that require understanding context

## Setting up an AI service

Declare an AI service in the `services:` block, just like you would for a regular web service:

```txt
services:
    Analyst is an AI using "openai/gpt-4o"
    Writer is an AI using "anthropic/claude-sonnet-4-20250514"
```

The format is `provider/model-name`:
- **openai** — ChatGPT models (`gpt-4o`, `gpt-4o-mini`)
- **anthropic** — Claude models (`claude-sonnet-4-20250514`, `claude-haiku-4-5-20251001`)

You can declare multiple AI services with different models for different tasks.

## Asking the AI to do something

Use the `ask` statement followed by the service name and your instruction:

```txt
ask Analyst to summarize the quarterly sales data
    save the result as summary

log summary
```

This sends the instruction to the AI model and saves the response. You can write any instruction in plain English — just like you would ask a colleague.

## Working with AI responses

When the AI responds, it includes two pieces of information:

- **result** — the actual text response from the AI
- **confidence** — a number from 0 to 1 showing how confident the AI is (1 = very confident)

```txt
ask Analyst to classify this support ticket as urgent or normal
    save the result as classification

if classification.confidence is above 0.8:
    log "High confidence: {classification.result}"
otherwise:
    log "Low confidence — needs a human to review this"
```

## Including data in your instructions

You can include variables and data in your instruction using curly braces:

```txt
set report to order.summary

ask Writer to write a friendly confirmation email for this order: {report}
    save the result as email-text

log email-text
```

This lets the AI see the actual data and respond accordingly.

## Setting up API keys

AI services require an API key to work. These are like passwords that identify you to the AI provider.

**Getting your API key:**
- **OpenAI (ChatGPT):** Sign up at [platform.openai.com](https://platform.openai.com/) and create an API key
- **Anthropic (Claude):** Sign up at [console.anthropic.com](https://console.anthropic.com/) and create an API key

**Adding the key to your project:**

Create a file called `.env` in your project folder (next to your `.flow` files):

```
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Flow automatically picks up the correct key based on which AI provider you're using. Never share this file or upload it to the internet.

## Testing without making real AI calls

AI calls cost money (a small amount per request). When you're developing and testing, use mock mode to avoid charges:

```bash
flow test my-workflow.flow --dry-run
```

In mock mode, AI calls return simulated responses. This lets you test that your workflow logic is correct without spending money on real AI calls.

## Complete example

Here's a workflow that automatically sorts incoming support tickets:

```txt
config:
    name: "Support Ticket Classifier"
    version: 1

services:
    Classifier is an AI using "openai/gpt-4o"

workflow:
    trigger: when a support ticket is received

    set message to ticket.body

    ask Classifier to classify this support message as "billing", "technical", or "general": {message}
        save the result as category

    if category.result contains "billing":
        log "Routing to billing team"
        complete with department "billing" and ticket ticket.id
    otherwise if category.result contains "technical":
        log "Routing to engineering"
        complete with department "engineering" and ticket ticket.id
    otherwise:
        log "Routing to general support"
        complete with department "general" and ticket ticket.id
```

This reads the ticket message, asks the AI to classify it, then routes it to the appropriate team based on the AI's response.

## Next steps

- [Services](/guide/services) — Connect to regular web services
- [Webhook Server](/guide/webhook-server) — Deploy workflows as web endpoints
- [Examples](/examples/) — See more real-world examples
