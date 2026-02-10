# Flow Language — Project Instructions

## Standing Rules

- **Update this file at the end of every phase** — refresh the Project Status, Decisions Log, and any new conventions discovered during implementation.
- **Run `npm run test` after every change** — all tests must pass before moving on.
- **Detailed plan lives in `IMPLEMENTATION_PLAN_V2.md` and `IMPLEMENTATION_PLAN_V3.md`** — this file is the quick reference, those files have the full task lists.

## Project Status

| Phase | Status | Tests | Notes |
|---|---|---|---|
| 1. Scaffolding | Complete | 14 (errors) | Types, error formatter, project config |
| 2. Lexer | Complete | 100 | Tokenizer with indentation, interpolation, compound keywords |
| 3. Parser | Complete | 64 | Recursive descent, all 7 constructs, error recovery |
| 4. Analyzer | Complete | 41 | Service resolution, variable def-before-use, scope checking, duplicates |
| 5. Runtime + CLI | Complete | 115 | Environment, evaluator, executor, mock connectors, CLI (check/run/test) |
| 6. Examples | Complete | 17 (integration) | Three .flow files + end-to-end integration tests |
| 7. Secrets/Env | Complete | 10 | dotenv loading, `--strict-env` flag, verbose warnings |
| 8. HTTP Connector | Complete | 12 | Async refactor, verb inference, `at` keyword, real HTTP, `--mock` flag |
| 9. AI Connector | Complete | 16 | Anthropic + OpenAI via SDKs, dynamic import, JSON response parsing |
| npm publish | Complete | — | Published as `flow-lang@0.1.0` on npm |
| 10. Webhook Server | Complete | 18 | `flow serve` command, Express, single/multi-file, supertest |
| 15. HTTP Headers | Complete | 15 | `with headers:` on service declarations, env interpolation |
| 16. Response Access | Complete | 10 | `save the status as`, `save the response headers as`, ServiceResponse wrapper |
| 17. Real Retry Delays | Complete | 6 | `waiting N seconds/minutes` now actually waits via setTimeout |
| 11. VS Code Extension | Planned | — | TextMate grammar, snippets, marketplace |
| 12. Logging | Planned | ~12 | Structured JSON logs, timing, `--output-log` |
| 13. Docs Site | Planned | — | VitePress + GitHub Pages |
| 14. Hosted Runtime | Planned (deferred) | TBD | Only if validated |

**Tests passing: 449 (phases 1–17 + input-file)**

## Decisions Log

Decisions made during implementation that weren't in the original brief:

1. **Compound keywords matched longest-first** — lexer sorts compound keyword list by length descending, so `is not empty` is matched before `is not`.
2. **String interpolation tokenized as parts** — `"Hello, {name}"` becomes `STRING_PART + INTERP_START + IDENTIFIER + INTERP_END + STRING_PART`, not re-parsed later.
3. **`FlowEmpty` type added** — the brief says "no nulls" but we need a way to represent absence. `FlowEmpty` with `type: "empty"` fills this role.
4. **Keywords allowed as variable names in `set`** — `set result to ...` is valid because `result` is a keyword but a natural variable name for users.
5. **Config "number + unit" collected as string** — `timeout: 5 minutes` is stored as the string `"5 minutes"`, not parsed further at the parser level.
6. **`parseProgram()` consumes INDENT/DEDENT in main loop** — required to prevent infinite loops during error recovery on unknown top-level blocks with indented content.
7. **Parser signature includes source** — `parse(tokens, source, fileName)` so that error messages can reference source lines directly.
8. **Dot-access roots are lenient** — expressions like `signup.email` or `order.items` are not flagged as undefined variables. They are treated as implicit trigger/service data, since Flow users access external data via dot notation.
9. **Scope model: loops create child scopes, steps don't** — `for each` loop variables are scoped to the loop body (child scope), while `step` blocks are purely organizational and share the parent scope.
10. **`env` is predefined** — the `env` identifier is always available in the global scope so `env.API_KEY` works without an explicit `set`.
11. **Runtime is async** — `execute()` returns `Promise<ExecutionResult>`. All service connectors return `Promise<ServiceResponse>`. Expression evaluation stays synchronous. Retry waits use real `setTimeout` delays.
12. **Complete/reject use throw signals** — `CompleteSignal` and `RejectSignal` are thrown to halt execution from any nesting depth, caught in the main `execute()` function.
13. **Missing dot-access fields return FlowEmpty** — `user.missing_field` returns `FlowEmpty` rather than throwing, consistent with the "no nulls but has empty" design.
14. **Math on text with `plus` means concatenation** — `"hello" plus " world"` produces `"hello world"`. Other math operators require numbers.
15. **Multiple complete outputs use `and`** — `complete with status "ok" and message msg` separates key-value pairs with `and`.
16. **`set` updates parent scope variables** — `set x to ...` inside a loop or child scope updates the nearest parent scope's `x` if it exists there, rather than creating a new local variable. This is the intuitive behavior for non-programmers writing accumulators.
17. **Interpolation supports hyphens in identifiers** — `{order-id}` works inside strings, matching Flow's support for hyphenated identifiers in regular code.
18. **Verb inference for HTTP methods** — The HTTP connector infers the HTTP method from the English verb: get/fetch/list→GET, create/send/submit→POST, update/modify→PUT, delete/remove→DELETE. Unknown verbs default to POST.
19. **`at` keyword for URL paths** — Service calls support optional `at "/path"` between service name and `with` params: `get user using API at "/users/123" with status "active"`.
20. **`--mock` flag on `flow run`** — Forces mock connectors instead of real HTTP calls, useful for development and testing.
21. **AI connectors use dynamic import** — `@anthropic-ai/sdk` and `openai` are loaded via `await import()` only when actually called, so missing one SDK doesn't crash the other.
22. **AI response format: JSON with fallback** — System prompt asks for `{ result, confidence }` JSON. If the LLM returns non-JSON, the raw text becomes `result` and confidence defaults to 0.5.
23. **AI API key deferred validation** — Missing API key error is thrown at `call()` time, not at connector construction. A declared-but-unused AI service won't crash the workflow.
24. **`buildConnectors` extracted to runtime** — Shared function in `src/runtime/index.ts` used by both CLI and server, avoids duplication.
25. **Server module separate from CLI** — `src/server/index.ts` exports `createApp()` (testable with supertest) and `startServer()` (used by CLI). `.flow` files pre-parsed at startup, only `execute()` runs per request.
26. **Server routes by filename** — In directory mode, each `.flow` file becomes a POST route: `email-verification.flow` → `POST /email-verification`. Single-file mode uses `POST /`.
27. **`--input-file` for file-based input** — `flow run` accepts `--input-file <path>` to read input from `.json`, `.csv`, `.xlsx`, or `.xls` files. Single-row spreadsheets become a flat record; multi-row become `{ rows: [...], count: N }`. Uses SheetJS (`xlsx` package). Cannot be combined with `--input`.
28. **`with headers:` for service HTTP headers** — Service declarations support an optional indented `with headers:` block. Headers are key-value pairs where values support string interpolation (e.g., `"Bearer {env.STRIPE_KEY}"`). Headers are evaluated once at workflow startup, after `env` is available. Custom headers merge with defaults (custom overrides). Only `api` and `webhook` types support headers; `ai`/`plugin` emit a warning.
29. **`ServiceResponse` wrapper for connector return values** — `ServiceConnector.call()` returns `Promise<ServiceResponse>` instead of `Promise<FlowValue>`. `ServiceResponse` contains `value` (the body), optional `status` (HTTP status code as number), and optional `headers` (response headers as string record). Mock connectors return `{ value: <FlowValue> }`. HTTPAPIConnector returns real status and headers.
30. **`save the status as` / `save the response headers as`** — Service calls support three save clauses: `save the result as` (body → FlowValue), `save the status as` (HTTP status → FlowNumber, or FlowEmpty if absent), `save the response headers as` (response headers → FlowRecord of strings, or FlowEmpty if absent).
31. **Real retry delays** — `retry N times waiting M seconds` uses `await new Promise(resolve => setTimeout(resolve, ms))` for actual delays between retries. Supports both seconds and minutes units (parser converts minutes to seconds × 60). Tests use Vitest fake timers (`vi.useFakeTimers()`) for deterministic verification.

## What This Is

Flow is a domain-specific programming language for AI agent and workflow orchestration. It lets non-engineers write automated workflows in structured English that execute deterministically. The interpreter is built in TypeScript.

**Core principle:** "If you can write a process document, you can write a Flow program."

## Target User

Technical Operators — Operations Managers, Business Analysts, Product Ops Leads — who are NOT software engineers. Every error message, CLI output, and design decision must be understandable by a non-programmer.

## Commands

```bash
npm run build        # Compile TypeScript
npm run test         # Run test suite (Vitest)
npm run lint         # Lint the codebase
flow check <file>    # Parse and analyze a .flow file
flow run <file>      # Execute a .flow file (--input <json>, --input-file <path>, --verbose, --strict-env, --mock)
flow test <file>     # Dry-run with mock services (--dry-run, --verbose)
flow serve <target>  # Start HTTP server for webhooks (--port, --verbose, --mock)
```

## Project Structure

```
src/
  lexer/          # Tokenizer: source text -> tokens
  parser/         # Parser: tokens -> AST
  analyzer/       # Semantic analysis: validates the AST
  runtime/        # Tree-walking interpreter + connectors
  server/         # Express webhook server (flow serve)
  cli/            # Commander.js CLI entry point
  types/          # Shared TypeScript types (tokens, AST nodes, errors)
  errors/         # Error formatting and suggestions
tests/
  lexer/          # 100 tests
  parser/         # 75 tests
  analyzer/       # 45 tests
  runtime/        # 167 tests
  server/         # 18 tests — webhook server (supertest)
  errors/         # 14 tests
  integration/    # 19 tests — end-to-end .flow file tests
examples/         # Four .flow files (email-verification, order-processing, loan-application, github-api)
```

## Key Architecture Notes

### ServiceConnector Interface
```typescript
interface ServiceResponse {
    value: FlowValue;
    status?: number;
    headers?: Record<string, string>;
}

interface ServiceConnector {
    call(verb: string, description: string, params: Map<string, FlowValue>, path?: string, headers?: Record<string, string>): Promise<ServiceResponse>;
}
```
All service interactions (API, AI, plugin, webhook) go through this interface. Implementations: `MockAPIConnector`, `MockAIConnector`, `MockPluginConnector`, `MockWebhookConnector` (for testing), `HTTPAPIConnector`, `WebhookConnector`, `PluginStubConnector`, `AnthropicConnector`, `OpenAIConnector` (for real execution).

### RuntimeOptions (extension point for connectors)
```typescript
interface RuntimeOptions {
    input?: Record<string, unknown>;
    connectors?: Map<string, ServiceConnector>;
    envVars?: Record<string, string>;
    verbose?: boolean;
}
```
Custom connectors are injected via `execute(program, source, options)`. The CLI builds the connector map from service declarations.

### Execution Flow
```
.flow file → Lexer → Parser → Analyzer → Runtime
  (text)     (tokens)  (AST)   (validated)  (result)
```

Each stage is independent and testable in isolation.

## Code Conventions

- **TypeScript strict mode** — no `any` types, ever
- **Vitest** for all testing
- **4-space indentation** in TypeScript source (matching Flow's own indentation rules)
- Small, single-purpose functions
- Comments only where the "why" isn't obvious — do not over-comment
- No emojis in source code or comments
- Test helpers: `types()`, `values()` for lexer; `pOk()`, `firstStmt()`, `pErrors()` for parser; `check()`, `checkOk()`, `checkHasError()`, `checkHasWarning()` for analyzer; `run()`, `runOk()`, `logMessages()` for runtime
- Error classes (`LexerError`, `ParserError`, `RuntimeError`) wrap `FlowError` for structured reporting
- Mock external dependencies in tests (fetch, SDKs) using `vi.fn()` — never make real HTTP/API calls in tests

## Error Message Standard

Every error must include:
1. File name
2. Line number
3. The problematic line of code
4. A plain English explanation (no compiler jargon)
5. A suggestion for how to fix it

```
Error in loan-application.flow, line 12:

    verify the email using EmailChecker

    I don't know what "EmailChecker" is. You haven't declared it
    in your services block.

    Did you mean "EmailVerifier"?

    Hint: Every service must be declared at the top of your file:
        services:
            EmailChecker is an API at "https://..."
```

## The Flow Language — Quick Reference

### File Structure
Three optional top-level blocks: `config:`, `services:`, `workflow:`

### Service Declarations
```
services:
    MyAPI is an API at "https://api.example.com"
        with headers:
            Authorization: "Bearer {env.API_KEY}"
            Accept: "application/json"
```
Headers are optional. Values support string interpolation for env vars. Only `api` and `webhook` types support headers.

### 7 Constructs (no more)
1. **Steps:** `<verb> <description> using <Service> [at <path>] [with <params>]`
2. **Conditions:** `if <condition>:` / `otherwise if:` / `otherwise:`
3. **AI Requests:** `ask <Agent> to <instruction>` with `save the result as`
4. **Variables:** `set <name> to <value/expression>`
5. **Repetition:** `for each <item> in <collection>:` (no while loops)
6. **Named blocks:** `step <Name>:`
7. **Output:** `complete with`, `reject with`, `log`

### 5 Data Types (no nulls)
Text, Number, Boolean, List, Record

### Indentation
4 spaces only. Tabs are rejected with a helpful error.

### Comparison Keywords
`is`, `is not`, `is above`, `is below`, `is at least`, `is at most`, `contains`, `is empty`, `is not empty`, `exists`, `does not exist`

### Math Keywords
`plus`, `minus`, `times`, `divided by`, `rounded to <n> places`

## What NOT to Build (for now)

- Pause/resume
- Parallel execution
- Import/include across files
- Plugin SDK (plugin connector is a stub until validated)

## Repository

- **GitHub:** https://github.com/AbrahamOluwa/flow-lang
- **License:** MIT
- **Node.js:** >= 18.0.0 (required for built-in fetch)
