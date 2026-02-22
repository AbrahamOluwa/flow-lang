# What is Flow?

Flow is a programming language designed for people who aren't programmers. Instead of writing code with symbols and jargon, you write automated workflows in structured English — and a computer runs them for you.

**Core principle:** If you can write a process document, you can write a Flow program.

## Who is Flow for?

Flow is built for people who need to automate work but don't want to learn traditional programming. That includes:

- **Operations Managers** who want to automate repetitive processes
- **Business Analysts** who need to connect systems together
- **Product Ops Leads** who want to build internal tools
- **Anyone** who has ever said: "I wish I could just tell the computer what to do in plain English"

If you've ever written a process like:

> 1. When a new order comes in, check the inventory
> 2. If all items are in stock, calculate the total
> 3. Charge the customer's payment method
> 4. Send a confirmation email

...then you already know how to think in Flow. That process document **is** basically a Flow program.

## What does Flow look like?

Here's a real Flow program that verifies an email address:

```txt
config:
    name: "Email Verification"
    version: 1

services:
    EmailVerifier is an API at "https://verify.example.com/api"

workflow:
    trigger: when a form is submitted

    set email to signup.email
    log "Verifying email: {email}"

    verify email using EmailVerifier with address email

    if email is not empty:
        complete with status "verified" and email email
    otherwise:
        reject with "The email address could not be verified"
```

Notice what's **not** there: no semicolons, no curly brackets, no `function()` or `class`, no mysterious symbols. Just structured English that reads like a set of instructions.

## What can Flow do?

- **Connect to web services** — Send and receive data from any online service (like GitHub, Stripe, or your company's internal tools)
- **Make decisions** — "If the order total is above $100, apply a discount"
- **Process lists** — "For each item in the order, check if it's in stock"
- **Use AI** — "Ask the AI to summarize this support ticket"
- **Handle problems** — "If the payment fails, try again 3 times"
- **Respond to events** — Turn your workflow into a web endpoint that runs automatically when triggered

## What Flow is NOT

Flow is intentionally focused. It does one thing well: automating workflows. You won't build a website, a mobile app, or a game with it.

This is a feature, not a limitation. By keeping the language small and focused, every Flow program stays readable and understandable — even months after you wrote it.

## What Flow can't do (yet)

We'd rather be upfront about boundaries than let you find them the hard way.

- **No parallel execution** — Steps run one at a time, top to bottom. You can't fire off three API calls simultaneously and wait for all of them. If you need that, you need a general-purpose language.
- **No pause and resume** — A Flow workflow runs from start to finish in one go. There's no way to pause mid-workflow, wait for a human approval, and pick up where you left off. Long-running approval chains aren't a good fit today.
- **No loops other than `for each`** — There are no `while` loops or infinite loops. Flow processes a list and moves on. This is intentional — it prevents runaway workflows — but it means you can't poll an endpoint until a condition changes.
- **No imports or modules** — Each `.flow` file is self-contained. You can't share logic between files or build a library of reusable steps. If you find yourself copying the same block into multiple workflows, Flow doesn't have an answer for that yet.
- **No database or state** — Flow doesn't store anything between runs. It connects to services, processes data, and returns a result. If you need to remember something across workflow executions, that state lives in your database or external service, not in Flow.
- **No frontend, no UI** — Flow runs on the server (or your terminal). It doesn't render pages, handle user sessions, or replace your application code.
- **No custom functions** — You can't define reusable functions or subroutines within Flow. What you see is what runs.

Some of these are on the roadmap. Some are deliberate constraints that keep Flow simple. If your use case hits one of these walls, Flow might not be the right tool — and that's okay.

## How it works behind the scenes

You don't need to understand this to use Flow, but if you're curious:

When you run a Flow program, it goes through four steps:

1. **Reading** — Flow reads your text and understands the structure (keywords, values, indentation)
2. **Understanding** — Flow builds a picture of what your workflow should do
3. **Checking** — Flow looks for mistakes before anything runs (typos, references to services you forgot to declare, etc.) and tells you exactly what's wrong and how to fix it
4. **Running** — Flow executes your workflow step by step

The key part is step 3: Flow catches your mistakes **before** running, so you never accidentally send bad data to a real service. The error messages are written in plain English with suggestions for how to fix the problem.

## Next steps

Ready to try it? Head to [Getting Started](/guide/getting-started) to install Flow and run your first workflow in under a minute.
