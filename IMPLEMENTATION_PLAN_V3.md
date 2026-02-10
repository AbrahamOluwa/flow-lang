# Flow Language — Implementation Plan V3: Production Readiness

## Overview

Three focused phases (15–17) that take Flow from a working prototype to a tool people can use with real, authenticated APIs. These are the minimum features needed to unlock real-world adoption.

**Build order follows impact:**
HTTP Headers (auth) → Response Access (status codes, response headers) → Real Retry Delays

Each phase is gated: all tests must pass before moving to the next phase.

**Prerequisite:** Phases 1–10 + Input File Support are complete (418 tests passing).

---

## Phase 15: HTTP Request Headers — COMPLETE

**Goal:** Service declarations can include custom HTTP headers, so users can authenticate with any API. This is the single biggest blocker to real-world usage.

**Why first:** Without `Authorization` headers, Flow cannot call any authenticated API — Stripe, GitHub, Paystack, Twilio, or any internal service. This one feature unlocks the majority of real-world use cases.

### Syntax Design

Service declarations gain an optional indented `with headers:` block:

```
services:
    Stripe is an API at "https://api.stripe.com/v1"
        with headers:
            Authorization: "Bearer {env.STRIPE_SECRET_KEY}"
            Stripe-Version: "2024-06-20"

    GitHub is an API at "https://api.github.com"
        with headers:
            Authorization: "token {env.GITHUB_TOKEN}"
            Accept: "application/vnd.github.v3+json"
            User-Agent: "flow-lang"

    InternalAPI is an API at "https://api.internal.com"
```

**Design decisions:**
- Headers are declared once per service, sent with every request to that service
- Header values support string interpolation (`{env.VAR}`) for secrets
- Header values are evaluated once at workflow start (after `env` is set up), not per-call
- Custom headers merge with defaults — custom values override built-in `Content-Type` and `Accept`
- Headers are optional — services without headers work exactly as before (no breaking changes)
- `with headers:` uses `with` keyword prefix for natural English readability
- Only `api` and `webhook` service types support headers (`ai` and `plugin` do not)

### Pipeline Changes Summary

```
Types       →  Add headers field to ServiceDeclaration AST node
Lexer       →  No changes (all tokens already exist)
Parser      →  Parse optional "with headers:" indented block after service declaration
Analyzer    →  Validate headers only on api/webhook types; check header expressions
Runtime     →  Evaluate header expressions at startup; pass to connectors
Connectors  →  HTTPAPIConnector and WebhookConnector merge custom headers into requests
CLI/Server  →  No changes needed (headers flow through existing buildConnectors path)
```

### Tasks

- [ ] **#71 Update AST types for service headers**
  - Add `headers` field to `ServiceDeclaration` in `src/types/index.ts`:
    ```typescript
    export interface ServiceHeader {
        name: string;           // e.g., "Authorization"
        value: Expression;      // e.g., StringLiteral or InterpolatedString
        loc: SourceLocation;
    }

    export interface ServiceDeclaration {
        kind: "ServiceDeclaration";
        name: string;
        serviceType: ServiceType;
        target: string;
        headers: ServiceHeader[];   // NEW — empty array if no headers
        loc: SourceLocation;
    }
    ```
  - Update all existing code that constructs `ServiceDeclaration` nodes to include `headers: []`

- [ ] **#72 Update parser to handle `with headers:` block**
  - In `parseServiceDeclaration()` (src/parser/index.ts):
    - After parsing the main declaration line (name, type, target), check if the next tokens indicate an indented block
    - Look for the sequence: NEWLINE → INDENT → `with` → IDENTIFIER("headers") → COLON
    - If found, parse header entries inside a nested INDENT/DEDENT block
    - Each header entry: IDENTIFIER (header name) → COLON → Expression (header value)
    - Collect into `ServiceHeader[]` array
    - If no `with headers:` block, set `headers: []`
  - Handle edge cases:
    - Multiple headers (each on its own indented line)
    - Single header
    - String interpolation in header values (`"Bearer {env.KEY}"`)
    - Plain string header values (`"application/json"`)

- [ ] **#73 Update analyzer to validate service headers**
  - In `src/analyzer/index.ts`:
    - When analyzing service declarations, validate header expressions
    - Warn if headers are declared on `ai` or `plugin` service types (headers are ignored for these)
    - Check for duplicate header names on the same service (warning, not error — last one wins)
    - Validate that header value expressions are valid (catch typos in `env.` references if strict mode)

- [ ] **#74 Update ServiceConnector interface and runtime**
  - Extend `ServiceConnector.call()` signature in `src/runtime/index.ts`:
    ```typescript
    export interface ServiceConnector {
        call(
            verb: string,
            description: string,
            params: Map<string, FlowValue>,
            path?: string,
            headers?: Record<string, string>    // NEW
        ): Promise<FlowValue>;
    }
    ```
  - Update ALL connector implementations to accept the new optional parameter:
    - `MockAPIConnector` — accept and ignore
    - `MockAIConnector` — accept and ignore
    - `MockPluginConnector` — accept and ignore
    - `MockWebhookConnector` — accept and ignore
    - `HTTPAPIConnector` — use headers (Task #75)
    - `WebhookConnector` — use headers (Task #76)
    - `AnthropicConnector` — accept and ignore
    - `OpenAIConnector` — accept and ignore
    - `PluginStubConnector` — accept and ignore
  - In `execute()` function: after setting up the global environment (including `env` record), evaluate all service header expressions and store resolved headers by service name in the execution context
  - In `executeServiceCall()`: look up resolved headers for the called service and pass them to `connector.call()`

- [ ] **#75 Update HTTPAPIConnector to use custom headers**
  - In `HTTPAPIConnector.call()`:
    - Accept optional `headers` parameter (`Record<string, string>`)
    - Merge custom headers with default headers:
      - GET/DELETE default: `{ "Accept": "application/json" }`
      - POST/PUT default: `{ "Content-Type": "application/json", "Accept": "application/json" }`
    - Custom headers override defaults (e.g., custom `Accept` replaces default `Accept`)
    - Use spread: `{ ...defaultHeaders, ...customHeaders }`

- [ ] **#76 Update WebhookConnector to use custom headers**
  - Same pattern as HTTPAPIConnector:
    - Accept optional `headers` parameter
    - Merge with default `{ "Content-Type": "application/json" }`
    - Custom headers override defaults

- [ ] **#77 Write parser tests** (target: 5 tests)
  - Service declaration with `with headers:` block parses correctly
  - Service declaration without headers still works (backward compatible)
  - Multiple headers parsed in order
  - Header value with string interpolation parsed as InterpolatedString expression
  - Header value with plain string parsed as StringLiteral expression

- [ ] **#78 Write analyzer tests** (target: 3 tests)
  - Headers on API service type — no warnings
  - Headers on webhook service type — no warnings
  - Headers on AI service type — produces warning
  - (Duplicate header name warning — can combine with above)

- [ ] **#79 Write runtime tests** (target: 6 tests)
  - Custom headers are passed to HTTPAPIConnector fetch calls
  - Custom headers override default headers (e.g., custom Accept)
  - Header values with `env.*` interpolation resolve correctly
  - Headers with plain string values work
  - WebhookConnector receives custom headers
  - Service without headers still works (no regression)

- [ ] **#80 Write integration test** (target: 1 test)
  - End-to-end `.flow` file with service declaration including headers, calling a mock HTTP endpoint that verifies the headers were received

- [ ] **#81 Update examples and documentation**
  - Add a new example file: `examples/github-api.flow` demonstrating authenticated API usage:
    ```
    config:
        name: "GitHub Repository Info"
        version: 1

    services:
        GitHub is an API at "https://api.github.com"
            with headers:
                Authorization: "token {env.GITHUB_TOKEN}"
                Accept: "application/vnd.github.v3+json"
                User-Agent: "flow-lang"

    workflow:
        trigger: when a request is received

        get repository using GitHub at "/repos/{repo-owner}/{repo-name}"
            save the result as repo

        complete with name repo.name and stars repo.stargazers_count
    ```
  - Update CLAUDE.md with:
    - Decision #28: `with headers:` syntax for service-level HTTP headers
    - Updated service declaration syntax in Quick Reference
    - Updated test count

### Test Summary

| Category | New Tests | Description |
|---|---|---|
| Parser | 5 | `with headers:` syntax variations |
| Analyzer | 3 | Header validation per service type |
| Runtime | 6 | Header passing, merging, interpolation |
| Integration | 1 | End-to-end with headers |
| **Total** | **15** | **Target: 433 total** |

---

## Phase 16: Response Access — COMPLETE

**Goal:** Service calls return structured responses so users can check status codes, access response headers, and handle errors based on HTTP status.

**Why:** Without response metadata, users can't distinguish a 200 from a 429 or 500. They can't implement rate-limit backoff, read transaction IDs from response headers, or show meaningful error messages.

### Proposed Syntax

```
verify payment using Stripe at "/charges" with amount total
    save the result as charge
    save the status as http-status
    save the response headers as response-headers

if http-status is not 200:
    log "Payment API returned status {http-status}"
    reject with "Payment processing failed"
```

### Tasks (high-level — detailed planning when Phase 15 is complete)

- [ ] **#82 Design response object structure**
  - Service calls return `{ result, status, headers }` record instead of raw result
  - `save the result as` extracts `result` field (backward compatible)
  - New `save the status as` extracts HTTP status code
  - New `save the response headers as` extracts response headers as a record

- [ ] **#83 Update ServiceConnector to return structured responses**
- [ ] **#84 Update parser for new `save the ...` clauses**
- [ ] **#85 Update runtime to populate response metadata**
- [ ] **#86 Write tests** (target: ~10 tests)

---

## Phase 17: Real Retry Delays — COMPLETE

**Goal:** `retry N times waiting M seconds` actually waits, with optional exponential backoff.

**Why:** Without real delays, retries hammer failing services instantly. This causes cascading failures and gets Flow workflows rate-limited or blocked.

### Proposed Syntax

```
verify email using EmailVerifier with address email
    on failure:
        retry 3 times waiting 2 seconds
        if still failing:
            reject with "Email verification unavailable"
```

No syntax changes needed — the syntax already exists. Only the runtime behavior changes.

### Tasks (high-level)

- [x] **#87 Implement real `setTimeout`-based delays in retry logic**
  - Currently the wait is a no-op comment in the executor
  - Add `await new Promise(resolve => setTimeout(resolve, waitMs))`
  - Parse "N seconds" / "N minutes" from the retry wait config

- [ ] **#88 Add exponential backoff option** (optional, deferred)
  - Syntax: `retry 3 times with backoff starting at 1 second`
  - Doubles wait each attempt: 1s, 2s, 4s

- [x] **#89 Write tests** (target: ~6 tests)
  - Retry actually waits (use fake timers in Vitest)
  - Wait duration matches config
  - Multiple retries space out correctly

---

## Build Order Summary

```
Phase 15: HTTP Headers        →  ~15 tests   (authenticated API calls)
Phase 16: Response Access     →  ~10 tests   (status codes, response metadata)
Phase 17: Real Retry Delays   →  ~6 tests    (actual wait + backoff)
```

**Estimated new tests: ~31 (bringing total from 418 to ~449)**

Each phase is gated: all tests must pass before moving to the next phase.

---

## What This Unlocks

After these three phases, a fintech operator can:

1. **Call authenticated APIs** — Stripe, Paystack, internal services (Phase 15)
2. **Handle errors by status code** — retry on 429, fail on 401, log on 500 (Phase 16)
3. **Retry gracefully** — wait between retries, back off exponentially (Phase 17)

This covers the core loop of any API-driven workflow: authenticate → call → check response → handle errors → retry if needed.
