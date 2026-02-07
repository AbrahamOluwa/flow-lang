# Flow Language — Architecture

## System Overview

Flow is a tree-walking interpreter implemented in TypeScript. Source code in `.flow` files passes through four sequential stages before producing output.

```
┌─────────────┐     ┌──────────┐     ┌────────────┐     ┌───────────┐
│  .flow file │────>│  Lexer   │────>│   Parser   │────>│ Analyzer  │
│  (source)   │     │ (tokens) │     │   (AST)    │     │ (validate)│
└─────────────┘     └──────────┘     └────────────┘     └─────┬─────┘
                                                              │
                                                              v
                                                        ┌───────────┐
                                                        │  Runtime  │
                                                        │ (execute) │
                                                        └───────────┘
```

Each stage is a pure function (input → output) with no shared mutable state between stages. This makes each stage independently testable.

---

## Stage 1: Lexer (Tokenizer)

**Location:** `src/lexer/`

**Input:** Raw `.flow` source text (string)

**Output:** `Token[]` — an ordered array of tokens

### Token Structure

```typescript
interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}
```

### Token Types

| Category | Token Types |
|---|---|
| Structure | `INDENT`, `DEDENT`, `NEWLINE`, `EOF` |
| Literals | `STRING`, `NUMBER`, `BOOLEAN` |
| Identifiers | `IDENTIFIER` |
| Keywords | `KEYWORD` (single), `KEYWORD_COMPOUND` (multi-word) |
| Operators | `COLON`, `DOT`, `HASH` |
| Interpolation | `INTERP_START`, `INTERP_END` |

### Key Design Decisions

**Indentation handling (Python-style):**
The lexer maintains an indentation stack. When indentation increases by 4 spaces, it emits an `INDENT` token. When it decreases, it emits one or more `DEDENT` tokens. Tabs are rejected immediately with a helpful error.

**Multi-word keywords:**
Compound keywords like `is above`, `on failure`, `for each`, `is not empty`, `divided by`, `otherwise if` are recognized as single `KEYWORD_COMPOUND` tokens during lexing. This simplifies parsing significantly. The lexer uses longest-match to resolve ambiguity (e.g., `is not empty` beats `is not` + `empty`).

**String interpolation:**
Strings like `"Hello, {name}"` are tokenized as a sequence: `STRING_PART("Hello, ")`, `INTERP_START`, `IDENTIFIER(name)`, `INTERP_END`, `STRING_PART("")`. This lets the parser build interpolation nodes without re-scanning strings.

**Comments:**
`#` begins a comment that runs to end of line. Comments are stripped during lexing and do not appear in the token stream.

---

## Stage 2: Parser

**Location:** `src/parser/`

**Input:** `Token[]` from lexer

**Output:** `Program` AST node (the root of the abstract syntax tree)

### AST Node Hierarchy

```
Program
├── ConfigBlock
│   └── ConfigEntry[]          (key-value pairs: name, version, timeout)
│
├── ServicesBlock
│   └── ServiceDeclaration[]   (name, type, target)
│       - type: "api" | "ai" | "plugin" | "webhook"
│
└── WorkflowBlock
    ├── TriggerDeclaration     (trigger type and parameters)
    │
    └── Statement[]            (ordered list of workflow statements)
        │
        ├── StepBlock          (named block: label + child statements)
        │
        ├── ServiceCall        (verb, description, service, parameters)
        │
        ├── AskStatement       (agent, instruction, result/confidence saves)
        │
        ├── SetStatement       (variable name, value expression)
        │
        ├── IfStatement        (condition, body, otherwise-if chain, otherwise)
        │
        ├── ForEachStatement   (item name, collection expression, body)
        │
        ├── LogStatement       (expression to log)
        │
        ├── CompleteStatement   (key-value output pairs)
        │
        ├── RejectStatement    (message expression)
        │
        └── ErrorHandler       (attached to a ServiceCall: retry config, fallback)
```

### Parsing Strategy

**Recursive descent parser** — each AST node type has a dedicated parsing function. The parser consumes tokens left-to-right, one at a time, making decisions based on the current token.

**Top-level dispatch:** The parser looks for `config:`, `services:`, or `workflow:` keywords at the top level. These can appear in any order but each may appear at most once.

**Statement dispatch:** Inside `workflow:`, the parser examines the first token(s) of each line to determine the statement type:
- `step` → StepBlock
- `if` → IfStatement
- `otherwise` → part of IfStatement chain
- `for each` → ForEachStatement
- `set` → SetStatement
- `ask` → AskStatement
- `complete` → CompleteStatement
- `reject` → RejectStatement
- `log` → LogStatement
- Anything else → ServiceCall (the default, since steps are verb-first)

**Error recovery:** On parse error, the parser records the error with line/column info, skips to the next line at the same or lower indentation level, and continues parsing. This allows reporting multiple errors in one pass.

### Expression Model

Expressions in Flow are intentionally simple:

```
Expression
├── StringLiteral          ("hello")
├── InterpolatedString     ("Hello, {name}")
├── NumberLiteral          (42, 3.14)
├── BooleanLiteral         (true, false)
├── Identifier             (score, signup)
├── DotAccess              (signup.email, response.body.id)
├── MathExpression         (item.price times item.quantity)
└── ComparisonExpression   (score is above 50)
```

No function calls, no complex operators, no ternaries. Expressions are flat.

---

## Stage 3: Semantic Analyzer

**Location:** `src/analyzer/`

**Input:** `Program` AST node

**Output:** Validated `Program` (same node, annotated) or error list

### Validation Checks

| Check | Description |
|---|---|
| Service resolution | Every `using <Service>` references a declared service |
| Variable def-before-use | `set x to ...` must appear before any read of `x` |
| Variable scoping | Loop variables (`for each item in ...`) scoped to loop body |
| Condition validity | Comparison operators are valid for the operand types |
| No duplicate step names | Each `step <Name>:` must be unique |
| Type compatibility | Warnings for obvious type mismatches (e.g., math on text) |
| Config validation | Known config keys, valid timeout format |
| Trigger validation | Trigger type is recognized |

### Scope Model

The analyzer maintains a scope chain:
- **Global scope:** services, config values, trigger data
- **Workflow scope:** variables set at the top level of workflow
- **Block scope:** loop variables inside `for each`

Named steps (`step X:`) do NOT create new scopes — they are organizational only.

### Error Collection

The analyzer collects all errors in a single pass rather than stopping at the first one. Each error includes enough context for the error formatter to produce the standard error message format with suggestions.

---

## Stage 4: Runtime (Interpreter)

**Location:** `src/runtime/`

**Input:** Validated `Program` AST + input data (JSON) + service connectors

**Output:** Workflow result (complete/reject) + execution log

### Execution Model

**Tree-walking interpreter:** The runtime walks the AST top-down, executing each statement in order. There is no compilation step or intermediate representation.

### Environment (Variable Store)

```typescript
interface Environment {
    parent: Environment | null;
    variables: Map<string, FlowValue>;
}
```

Scoped with parent chain lookup. New environments created for `for each` loops.

### FlowValue Type System

```typescript
type FlowValue =
    | { type: "text"; value: string }
    | { type: "number"; value: number }
    | { type: "boolean"; value: boolean }
    | { type: "list"; value: FlowValue[] }
    | { type: "record"; value: Map<string, FlowValue> };
```

No null. If a value is absent, `is empty` returns true.

### Service Connectors (v1: mocked)

```typescript
interface ServiceConnector {
    call(action: string, params: Record<string, FlowValue>): Promise<FlowValue>;
}
```

In v1, all services use mock connectors that return predictable test data. Real connectors (HTTP, AI model calls, plugins) are out of scope.

### Error Handling at Runtime

Default behavior for service calls:
1. First attempt
2. If failure: retry once
3. If second failure: log error, stop workflow with error result

Custom `on failure` blocks override this with user-specified retry count, wait time, and fallback actions.

### Execution Log

The runtime maintains a structured log of every action taken:

```typescript
interface LogEntry {
    timestamp: Date;
    step: string | null;      // Named step, if inside one
    action: string;           // What happened
    result: "success" | "failure" | "skipped";
    details: Record<string, unknown>;
}
```

This log is returned with the result and can be printed by the CLI.

---

## CLI Layer

**Location:** `src/cli/`

**Framework:** Commander.js

### Commands

| Command | Pipeline | Output |
|---|---|---|
| `flow check <file>` | Lexer → Parser → Analyzer | Errors or "No errors found" |
| `flow run <file> --input <json>` | Full pipeline | Workflow result + log |
| `flow test <file> --dry-run` | Full pipeline (mock services) | Simulated result + log |

### Input Data

`--input` accepts a JSON file or inline JSON. This data becomes available in the workflow as the trigger's payload (e.g., `signup.email` for a form submission trigger).

---

## Error Formatting

**Location:** `src/errors/`

A centralized error formatter takes raw error objects from any stage and produces the standard output format:

```
Error in <file>, line <n>:

    <the offending source line>

    <plain English explanation>

    <suggestion / hint>
```

The formatter has access to the original source text (for showing the offending line) and the service/variable declarations (for "did you mean?" suggestions). Levenshtein distance is used for suggestions.

---

## Module Dependency Graph

```
cli
 └── runtime
      └── analyzer
           └── parser
                └── lexer
                     └── types

errors (used by all stages)
types  (used by all stages)
```

Each module depends only on the stage before it and on shared types/errors. No circular dependencies.
