# Getting Started

This guide will walk you through installing Flow and running your first workflow. It takes about 2 minutes.

## Prerequisites

Flow runs on [Node.js](https://nodejs.org/), which is a free tool that lets you run programs on your computer. If you don't have it yet:

1. Go to [nodejs.org](https://nodejs.org/)
2. Download the **LTS** version (the big green button)
3. Run the installer — accept all the defaults

You need version 18 or higher. To check, open your terminal (Command Prompt on Windows, Terminal on Mac) and type:

```bash
node --version
```

You should see something like `v20.11.0` or higher.

## Install Flow

Open your terminal and run:

```bash
npm install -g flow-lang
```

This installs Flow globally on your computer. Verify it worked:

```bash
flow --version
```

## Write your first workflow

Create a new file called `hello.flow` (you can use any text editor — Notepad, VS Code, etc.) and paste this in:

```txt
config:
    name: "Hello World"
    version: 1

workflow:
    trigger: when a name is provided

    set greeting to "Hello, {request.name}!"
    log greeting

    complete with message greeting
```

Let's break down what this does:

- **config** — Gives your workflow a name and version number
- **trigger** — Describes when this workflow should run (it's documentation for you)
- **set greeting** — Creates a variable called `greeting` with a personalized message
- **log** — Prints the greeting so you can see it
- **complete with** — Returns the result when the workflow finishes

## Check your workflow for errors

Before running, you can check for mistakes:

```bash
flow check hello.flow
```

If everything looks good:

```
hello.flow is valid — no errors found.
```

If there's a problem, Flow tells you exactly what's wrong and suggests a fix. For example:

```
Error in hello.flow, line 7:

    log greting

    I don't recognize "greting" — it hasn't been defined yet.

    Did you mean "greeting"?
```

## Run your workflow

Now run it! The `--input` flag lets you pass data into the workflow:

```bash
flow run hello.flow --input '{"name": "Alice"}'
```

::: tip Windows users
Windows CMD and PowerShell handle quotes differently. Use escaped double quotes instead:
```bash
flow run hello.flow --input "{\"name\": \"Alice\"}"
```
:::

You should see:

```
[LOG] Hello, Alice!

Workflow completed successfully.

Outputs:
  message: Hello, Alice!
```

The `{"name": "Alice"}` you passed in becomes accessible as `request.name` inside the workflow.

## Test with mock services

If your workflow connects to external services (like APIs), you can test it without making real calls:

```bash
flow test hello.flow --dry-run --verbose
```

This runs your workflow with simulated services. It's perfect for checking that your logic is correct without affecting real systems.

## Serve as a webhook

You can turn any workflow into a web endpoint that responds to incoming requests:

```bash
flow serve hello.flow --port 3000
```

Then trigger it by sending a request (you can use a tool like curl, Postman, or any webhook sender):

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}'
```

## Understanding the file structure

Every Flow file can have three sections (all optional):

```txt
config:
    name: "My Workflow"
    version: 1

services:
    MyAPI is an API at "https://api.example.com"

workflow:
    trigger: when something happens

    # Your workflow logic goes here
```

- **config** — Metadata about your workflow (name, version, how long it can run)
- **services** — Declares external services your workflow will talk to (APIs, AI models)
- **workflow** — The actual logic that runs when the workflow is triggered

## Important: indentation matters

Flow uses **4 spaces** for indentation (not tabs). Everything inside a block must be indented by exactly 4 spaces. If you use tabs by mistake, Flow will tell you and show you how to fix it.

```txt
workflow:
    trigger: when something happens    # 4 spaces before "trigger"

    if active:
        log "User is active"          # 8 spaces (4 + 4)
```

Most text editors can be set to insert spaces when you press Tab. In VS Code, look for "Indent Using Spaces" in the bottom status bar.

## Next steps

Now that you have Flow running, explore these guides:

- [Services](/guide/services) — Learn how to connect to external APIs and use the data
- [AI Integration](/guide/ai-integration) — Use AI models directly in your workflows
- [Language Reference](/reference/language) — Complete guide to every Flow feature
- [Examples](/examples/) — Real-world workflow examples you can learn from
