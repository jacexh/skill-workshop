---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

# Architecture

## Pattern Overview

**Overall:** [Pattern name: e.g., "Monolithic CLI", "Layered API", "Full-stack MVC", "Plugin Marketplace"]

**Key Characteristics:**
- [e.g., "Single executable with subcommands"]
- [e.g., "Stateless request handling"]
- [e.g., "File-based state, no database"]

## System Overview

<!-- One paragraph describing what this system does and its high-level architecture -->

## Layers

<!-- One entry per conceptual layer. Location is critical — it makes this actionable for planning. -->

**[Layer Name]:**
- Purpose: [What this layer does]
- Contains: [Types of code: e.g., "route handlers", "business logic"]
- Location: [`src/xxx/`]
- Depends on: [What it uses: e.g., "service layer only"]
- Used by: [What uses it: e.g., "CLI entry point"]

## Data Flow

<!-- Describe the primary data flows through the system. Use numbered steps. -->

**[Flow Name] (e.g., "HTTP Request", "CLI Command"):**

1. [Entry point]
2. [Processing step]
3. [Processing step]
4. [Output]

**State Management:**
- [How state is handled: e.g., "Stateless — no persistent state", "File-based in .planning/", "Database per request"]

## Entry Points

**[Entry Point Name]:**
- Location: [`path/to/file`]
- Triggers: [What invokes it: e.g., "CLI invocation", "HTTP request"]
- Responsibilities: [What it sets up or routes]

## Error Handling

<!-- System-level strategy: where errors are caught, what happens at boundaries.
     Code-level patterns (naming, async style) go in conventions.md. -->

**Strategy:** [e.g., "Throw exceptions, catch at command boundary", "Return Result<T,E>"]

**Patterns:**
- [e.g., "Services throw, command handlers catch and log, then exit(1)"]
- [e.g., "Validation errors surfaced before execution (fail fast)"]

## Cross-Cutting Concerns

**Logging:** [Approach: e.g., "console.log, no framework" or "pino, structured JSON"]
**Validation:** [Approach: e.g., "Zod schemas at API boundary" or "Manual in command handlers"]
**Authentication:** [Approach: e.g., "JWT middleware on protected routes" or "N/A"]

## Key Design Decisions

<!-- Brief notes on architectural choices that affect the whole system.
     Detailed rationale goes in decisions.md -->
