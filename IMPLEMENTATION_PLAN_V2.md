# Flow Language — Implementation Plan V2

## Overview

Eight new phases (7–14) that take Flow from a working interpreter with mock services to a production-ready workflow tool with real API/AI connectors, a webhook server, and developer tooling.

**Build order follows dependency chain:**
Secrets → HTTP Connector → AI Connector → npm publish → Webhook Server → VS Code Extension → Logging → Docs Site → Hosted Runtime

Each phase is gated: all tests must pass before moving to the next phase.

**Prerequisite:** Phases 1–6 are complete (351 tests passing).

---

## Phase 7: Secret Management and Environment Variables — COMPLETE

**Goal:** `.env` files load automatically so users never hardcode API keys into `.flow` files.

**Why first:** Every phase after this needs API keys. Without secrets management, users will paste keys directly into `.flow` files from day one.

### Tasks

- [x] **#30 Install dotenv**
  - Add `dotenv` as a production dependency
  - No config file needed — it reads `.env` from the current working directory by default

- [x] **#31 Update CLI to load `.env` before execution**
  - In `flow run`: call `dotenv.config()` before building `envVars`
  - Merge `process.env` (which now includes `.env` values) into `envVars`
  - In `flow test`: continue using mock env vars (no `.env` loading)
  - In `flow check`: no change needed (no execution)

- [x] **#32 Add `.env` to `.gitignore`**
  - Already present, verified
  - Created `.env.example` file documenting expected variables

- [x] **#33 Validate env access at runtime**
  - When a workflow accesses `env.SOME_KEY` and the value is missing, return `FlowEmpty` (current behavior)
  - Added `--strict-env` flag to `flow run` that errors on missing env vars
  - Logs a warning (in verbose mode) when an env var resolves to empty

- [x] **#34 Write tests** (10 tests)
  - Missing env var returns FlowEmpty (default mode)
  - `--strict-env` throws RuntimeError on missing env var
  - `--strict-env` does not throw for existing env var
  - Multiple env vars accessible in one workflow
  - Env vars in string interpolation
  - Env vars in conditions
  - Env vars don't override `--input` data
  - Verbose warning logged for missing env var
  - No warning for existing env var in verbose mode
  - No warning in non-verbose mode

---

## Phase 8: Generic HTTP/API Connector — COMPLETE

**Goal:** `using <Service>` calls hit real REST APIs instead of returning mock data. This is where Flow becomes usable for real tasks.

**Key architectural change:** The `ServiceConnector` interface is now async. `call()` returns `Promise<FlowValue>`. The entire executor chain is async. Verb inference maps English verbs to HTTP methods. The `at` keyword provides URL path building.

### Tasks

- [x] **#35 Make ServiceConnector async**
  - Changed interface: `call(verb, description, params): FlowValue` → `call(verb, description, params, path?): Promise<FlowValue>`
  - Updated all mock connectors to return `Promise<FlowValue>` via `async`
  - Added `async`/`await` through the executor chain (8 functions)
  - Updated CLI to `await execute(...)` calls

- [x] **#36 Implement HTTPAPIConnector**
  - New class implementing `ServiceConnector`
  - Constructor takes `baseUrl` from service declaration target
  - Uses Node.js built-in `fetch` (no dependencies)
  - Verb inference: maps English verbs to HTTP methods (get→GET, create→POST, update→PUT, delete→DELETE)
  - GET/DELETE: params become query string. POST/PUT: params become JSON body.
  - URL path building via optional `at` keyword in service calls
  - 30-second timeout via `AbortController`
  - JSON response parsed to FlowValue, non-JSON returned as text

- [x] **#37 Implement WebhookConnector**
  - Always POST with JSON body containing verb, description, and params
  - Returns `record({ status: text("ok") })` on 2xx
  - Throws on non-2xx with status code and body

- [x] **#38 Implement PluginStubConnector**
  - Falls back to mock behavior (returns mock plugin response)
  - Stub until plugin system is implemented

- [x] **#39 Wire real connectors into CLI**
  - `flow run`: builds real connectors from service declarations (api→HTTPAPIConnector, webhook→WebhookConnector, ai→mock, plugin→PluginStubConnector)
  - `flow test`: continues using mock connectors
  - Added `--mock` flag to `flow run` to force mock connectors
  - Parser: added `at` keyword for URL path expressions in service calls
  - Types: added `path: Expression | null` to ServiceCall AST node

- [x] **#40 Write tests** (12 new tests, 373 total)
  - All 125 existing runtime tests converted to async — all pass
  - All 17 integration tests converted to async — all pass
  - 6 inferHTTPMethod tests (GET/POST/PUT/DELETE verbs, unknown default, case-insensitive)
  - 1 PluginStubConnector test
  - 2 service call with `at` keyword runtime tests
  - 3 parser tests for `at` keyword (with path, with path+params, without path)

---

## Phase 9: Real AI Connector — COMPLETE

**Goal:** `ask <Agent> to <instruction>` calls real LLMs. Returns real results and confidence scores. This is Flow's differentiator.

### Tasks

- [x] **#41 Install AI SDKs**
  - Added `@anthropic-ai/sdk` and `openai` as production dependencies

- [x] **#42 Implement AnthropicConnector**
  - New class implementing `ServiceConnector`
  - Constructor takes target string and API key (defers missing-key error to call time)
  - Strips `anthropic/` prefix from target to get model name
  - System prompt instructs LLM to return JSON `{ result, confidence }`
  - Params included as context in the user message
  - Dynamic import of SDK (only loaded when needed)
  - Falls back to raw text + 0.5 confidence if JSON parsing fails

- [x] **#43 Implement OpenAIConnector**
  - Same pattern as AnthropicConnector
  - Strips `openai/` prefix, uses `chat.completions.create()`
  - Same system prompt and fallback behavior

- [x] **#44 Wire AI connectors into CLI**
  - `buildConnectors()` routes by target prefix: `anthropic/` → AnthropicConnector, `openai/` → OpenAIConnector
  - Unknown provider falls back to mock
  - API keys read from `process.env` (loaded by dotenv)

- [x] **#45 Write tests** (16 new tests, 389 total)
  - AnthropicConnector: model parsing, missing key error, JSON response, non-JSON fallback, SDK error, params context
  - OpenAIConnector: model parsing, missing key error, JSON response, non-JSON fallback, SDK error
  - Provider routing: Anthropic, OpenAI, mock fallback with ask statement
  - Created `examples/real-api-test.flow` for manual end-to-end testing

---

## npm Publish (between Phase 9 and 10)

**Goal:** Anyone can `npm install -g flow-lang` and start writing workflows.

### Tasks

- [x] **#46 Prepare package for publishing**
  - Verified `package.json` fields: name, version, description, main, bin, keywords, license, repository, homepage
  - Added `files` field to whitelist: `dist/`, `README.md`, `LICENSE`
  - Added `engines` field: `"node": ">=18.0.0"` (required for built-in fetch)
  - Added `prepublishOnly` script: `"npm run build && npm run test"`
  - Verified `dist/cli/index.js` has shebang line
  - Added `author` field, updated README for npm

- [x] **#47 Create npm account and publish**
  - `npm login` (browser-based auth)
  - `npm publish` with granular access token
  - Published as `flow-lang@0.1.0` (47.8 kB, 31 files)

---

## Phase 10: Webhook Trigger Server — COMPLETE

**Goal:** A lightweight HTTP server that listens for incoming requests and triggers workflows automatically. Flow becomes a production tool, not just a CLI.

**Key architectural decisions:** Server module in `src/server/index.ts` separate from CLI. `createApp()` exported for testing with supertest. `.flow` files pre-parsed at startup, only `execute()` runs per request. `buildConnectors()` extracted from CLI to `src/runtime/index.ts` as shared export.

### Tasks

- [x] **#48 Install Express**
  - Added `express` as production dependency
  - Added `@types/express` (dev), `supertest` and `@types/supertest` (dev) for testing

- [x] **#49 Implement `flow serve` command**
  - New CLI command: `flow serve <target> --port <port> --verbose --mock`
  - Single-file mode: `flow serve workflow.flow` — POST `/` triggers execution
  - Directory mode: `flow serve examples/` — each `.flow` file gets a route
  - Returns JSON: completed→200, rejected→400, error→500
  - Logs each request in verbose mode

- [x] **#50 Support multiple workflows**
  - `flow serve <directory>` scans for `.flow` files
  - Routes: `/email-verification`, `/order-processing`, etc.
  - 404 for unknown routes with list of available workflows

- [x] **#51 Health check and metadata endpoint**
  - `GET /health` → `{ "status": "ok" }`
  - `GET /` → workflow metadata (single-file) or list of workflows (directory)

- [x] **#52 Graceful shutdown and error isolation**
  - SIGINT/SIGTERM handlers for clean shutdown
  - One workflow failure doesn't crash the server
  - Try/catch wraps every request handler

- [x] **#53 Write tests** (18 tests, 407 total)
  - Health check and metadata (3 tests)
  - Single-file workflow execution (4 tests)
  - Multiple workflows from directory (4 tests)
  - Error handling and isolation (4 tests)
  - Configuration — mock mode, verbose mode, directory loading (3 tests)

---

## Phase 11: VS Code Extension

**Goal:** Syntax highlighting, basic autocomplete, and inline errors for `.flow` files. Quality-of-life improvement that makes Flow feel like a real language.

### Tasks

- [ ] **#54 Create extension project**
  - Scaffold with `yo code` (Yeoman VS Code extension generator)
  - Separate directory: `vscode-flow/` (or separate repo `flow-lang-vscode`)
  - Extension ID: `flow-lang`
  - `package.json` with `contributes.languages` and `contributes.grammars`

- [ ] **#55 Write TextMate grammar** (`flow.tmLanguage.json`)
  - Scopes:
    - `comment.line.hash` — `# ...`
    - `keyword.control` — `if`, `otherwise`, `for each`, `step`, `trigger`
    - `keyword.operator` — `is`, `is not`, `is above`, `is below`, `plus`, `minus`, `times`, `divided by`, `contains`, `exists`
    - `keyword.other` — `set`, `to`, `using`, `with`, `in`, `as`, `ask`, `save`, `log`, `complete`, `reject`, `retry`, `waiting`
    - `storage.type` — `config:`, `services:`, `workflow:`
    - `string.quoted.double` — `"..."`
    - `string.interpolated` — `{...}` inside strings
    - `constant.numeric` — numbers
    - `constant.language` — `true`, `false`, `empty`
    - `entity.name.type` — service names after `using` or `ask`
    - `entity.name.function` — step names after `step`
    - `variable.other` — identifiers
  - File association: `*.flow`

- [ ] **#56 Basic autocomplete (keyword snippets)**
  - Snippet completions for common constructs:
    - `step` → full step block template
    - `if` → if/otherwise template
    - `foreach` → for-each loop template
    - `ask` → ask statement with save template
    - `service` → service call template
    - `config` → config block template
    - `services` → services block template
    - `workflow` → workflow block template

- [ ] **#57 Publish to VS Code Marketplace**
  - `vsce package` → `.vsix` file
  - `vsce publish` → marketplace listing
  - Include screenshots in extension README

---

## Phase 12: Logging and Observability

**Goal:** Structured, timestamped execution logs for every workflow run. The audit trail that makes Flow valuable for compliance-heavy environments.

### Tasks

- [ ] **#58 Add timing to execution context**
  - Record `startTime` and `endTime` for:
    - Overall workflow execution
    - Each `step` block
    - Each service call / ask statement
  - Store durations in milliseconds on `LogEntry`

- [ ] **#59 Extend LogEntry with structured fields**
  - Current: `{ step, action, status, message }`
  - Add: `{ timestamp, duration, serviceCall?, input?, output?, error? }`
  - Timestamp: ISO 8601 format
  - Input/output: serialized FlowValues (for service calls and ask statements)

- [ ] **#60 Add `--output-log <path>` flag to CLI**
  - `flow run <file> --output-log execution.json`
  - Writes the full structured log as JSON after execution
  - Format:
    ```json
    {
      "workflow": "Order Processing",
      "version": 1,
      "status": "completed",
      "startedAt": "2026-02-07T12:00:00.000Z",
      "completedAt": "2026-02-07T12:00:01.234Z",
      "duration": 1234,
      "outputs": { ... },
      "steps": [
        {
          "name": "CheckInventory",
          "startedAt": "...",
          "duration": 456,
          "entries": [ ... ]
        }
      ]
    }
    ```

- [ ] **#61 Add log output to webhook server**
  - Each request's execution log included in response when `?verbose=true`
  - Logs written to stdout in structured JSON format (one line per request)

- [ ] **#62 Write tests** (target: ~12 tests)
  - LogEntry includes timestamp and duration
  - Step timing recorded correctly
  - Service call timing recorded
  - `--output-log` writes valid JSON file
  - Log includes workflow metadata (name, version, status)
  - Log includes all step entries in order
  - Failed workflows include error details in log

---

## Phase 13: Documentation Site

**Goal:** A standalone website where strangers can learn Flow without needing someone to explain it. Getting Started guide, language reference, examples, CLI reference.

### Tasks

- [ ] **#63 Choose framework and scaffold**
  - VitePress (recommended — lightweight, Markdown-based, fast)
  - Separate directory: `docs/`
  - Deploy to GitHub Pages (free)

- [ ] **#64 Write core pages**
  - **Home page** — hero with code example, tagline, quick start
  - **Getting Started** — install, first workflow, run it, what happened
  - **Language Reference** — all 7 constructs with full syntax and examples
  - **Data Types** — the 5 types, comparisons, math, empty handling
  - **Services** — how to declare and use APIs, AI, plugins, webhooks
  - **Error Messages** — how Flow reports errors, examples of common mistakes
  - **CLI Reference** — all commands with flags and examples
  - **Examples** — annotated walkthroughs of the three example workflows

- [ ] **#65 Add syntax highlighting for `.flow` code blocks**
  - Custom Shiki grammar (reuse TextMate grammar from Phase 10)
  - Code blocks in docs render with proper Flow syntax colors

- [ ] **#66 Deploy to GitHub Pages**
  - GitHub Actions workflow: build VitePress on push to `main`, deploy to `gh-pages`
  - Custom domain (optional, later)

---

## Phase 14: `flow deploy` and Hosted Runtime (Optional)

**Goal:** Deploy `.flow` files to a cloud runtime with execution, uptime, scaling, and monitoring. This is the SaaS product.

**Do not build this until:** People are actively using Flow and asking for hosted execution. Validate demand first.

### Tasks (high-level only — detailed planning when the time comes)

- [ ] **#67 Design hosted architecture**
  - Container-per-workflow or shared runtime
  - Execution isolation and sandboxing
  - Autoscaling based on request volume
  - Persistent logging and monitoring dashboard

- [ ] **#68 Implement `flow deploy` command**
  - `flow deploy <file>` — uploads workflow to hosted runtime
  - Returns a public webhook URL
  - Authentication: API key per user account

- [ ] **#69 Build management dashboard**
  - Web UI: list deployed workflows, view logs, manage secrets
  - Execution history with structured logs from Phase 12
  - Usage metrics and billing

- [ ] **#70 Infrastructure**
  - Cloud provider: AWS/GCP/Fly.io
  - CI/CD pipeline for the hosted service
  - Cost depends on scale — starts at ~$20/month for minimal infrastructure

---

## Build Order Summary

```
Phase 7:  Secrets/Env        →  COMPLETE     (10 tests, 361 total)
Phase 8:  HTTP Connector      →  COMPLETE     (12 tests, 373 total)
Phase 9:  AI Connector        →  COMPLETE     (16 tests, 389 total)
--- npm publish ---           →  COMPLETE     (flow-lang@0.1.0)
Phase 10: Webhook Server      →  COMPLETE     (18 tests, 407 total)
Phase 11: VS Code Extension   →  no tests    (TextMate grammar + snippets)
Phase 12: Logging             →  ~12 tests   (structured audit logs)
Phase 13: Docs Site           →  no tests    (VitePress + GitHub Pages)
Phase 14: Hosted Runtime      →  TBD         (only if validated)
```

Estimated new tests: ~62 remaining (bringing total to ~423+)

Each phase is gated: all tests must pass before moving to the next phase.
