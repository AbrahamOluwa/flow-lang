# Flow Language — Project Instructions

## Standing Rules

- **Update this file at the end of every phase** — refresh the Project Status, Decisions Log, and any new conventions discovered during implementation.

## Project Status

| Phase | Status | Tests | Notes |
|---|---|---|---|
| 1. Scaffolding | Complete | 14 (errors) | Types, error formatter, project config |
| 2. Lexer | Complete | 100 | Tokenizer with indentation, interpolation, compound keywords |
| 3. Parser | Complete | 64 | Recursive descent, all 7 constructs, error recovery |
| 4. Analyzer | Complete | 41 | Service resolution, variable def-before-use, scope checking, duplicates |
| 5. Runtime + CLI | Complete | 115 | Environment, evaluator, executor, mock connectors, CLI (check/run/test) |
| 6. Examples | Complete | 17 (integration) | Three .flow files + end-to-end integration tests |

**Total tests passing: 351**

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
11. **Runtime is synchronous** — no async/await. Mock connectors are synchronous. Retry waits are skipped (no actual delays).
12. **Complete/reject use throw signals** — `CompleteSignal` and `RejectSignal` are thrown to halt execution from any nesting depth, caught in the main `execute()` function.
13. **Missing dot-access fields return FlowEmpty** — `user.missing_field` returns `FlowEmpty` rather than throwing, consistent with the "no nulls but has empty" design.
14. **Math on text with `plus` means concatenation** — `"hello" plus " world"` produces `"hello world"`. Other math operators require numbers.
15. **Multiple complete outputs use `and`** — `complete with status "ok" and message msg` separates key-value pairs with `and`.
16. **`set` updates parent scope variables** — `set x to ...` inside a loop or child scope updates the nearest parent scope's `x` if it exists there, rather than creating a new local variable. This is the intuitive behavior for non-programmers writing accumulators.
17. **Interpolation supports hyphens in identifiers** — `{order-id}` works inside strings, matching Flow's support for hyphenated identifiers in regular code.

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
flow run <file>      # Execute a .flow file (--input <json>, --verbose)
flow test <file>     # Dry-run with mock services (--dry-run, --verbose)
```

## Project Structure

```
src/
  lexer/          # Tokenizer: source text -> tokens
  parser/         # Parser: tokens -> AST
  analyzer/       # Semantic analysis: validates the AST
  runtime/        # Tree-walking interpreter
  cli/            # Commander.js CLI entry point
  types/          # Shared TypeScript types (tokens, AST nodes, errors)
  errors/         # Error formatting and suggestions
tests/
  lexer/          # 100 tests
  parser/         # 64 tests
  analyzer/       # 41 tests
  runtime/        # 115 tests
  errors/         # 14 tests
  integration/    # 17 tests — end-to-end .flow file tests
examples/         # Three .flow files (email-verification, order-processing, loan-application)
```

## Code Conventions

- **TypeScript strict mode** — no `any` types, ever
- **Vitest** for all testing
- **4-space indentation** in TypeScript source (matching Flow's own indentation rules)
- Small, single-purpose functions
- Comments only where the "why" isn't obvious — do not over-comment
- No emojis in source code or comments
- Test helpers: `types()`, `values()` for lexer; `pOk()`, `firstStmt()`, `pErrors()` for parser; `check()`, `checkOk()`, `checkHasError()`, `checkHasWarning()` for analyzer; `run()`, `runOk()`, `logMessages()` for runtime
- Error classes (`LexerError`, `ParserError`, `RuntimeError`) wrap `FlowError` for structured reporting

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

### 7 Constructs (no more)
1. **Steps:** `<verb> <description> using <Service> [with <params>]`
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

## What NOT to Build

- Real service connectors (use mocks)
- Pause/resume
- Parallel execution
- Import/include across files
- Plugin SDK
- VS Code extension
- Webhook server

## Architecture Pipeline

```
.flow file -> Lexer -> Parser -> Semantic Analyzer -> Runtime
```

Each stage is independent and testable in isolation.
