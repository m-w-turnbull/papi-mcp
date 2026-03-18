# Akamai Property Config Agent

## Project Overview
An AI agent for authoring, modifying, validating, and activating Akamai Property Manager (PAPI) configuration files. The agent manages the complete lifecycle from config changes to production activation, with integration into GitLab and GitHub CI/CD pipelines.

## Architecture

```
Claude Code / Claude Desktop  ──┐
                                 ├── MCP (stdio) ──▶  MCP Server (Akamai Skills)  →  GitLab/GitHub MR/PR  →  Staging/Production
VS Code Copilot Chat  ──────────┘
```

### Three Layers
1. **MCP Server** — Akamai toolbelt (actions, API calls, file ops)
2. **Skill / System Prompt** — Akamai domain reasoning (rule tree logic, patterns, conventions)
3. **Platform Adapters** — Claude Code, Claude Desktop, and VS Code Copilot Chat all connect via stdio MCP transport

## Explicit Boundaries

### In Scope
- Parse and understand existing property configs
- Reason about and generate rule tree changes (behaviors, match criteria, variables)
- Validate configs (syntax, logic, PAPI schema compliance)
- Diff changes for human review
- Open GitLab/GitHub merge requests/pull requests with plain-English descriptions of changes
- Activate property versions to Akamai staging and production networks
- Trigger CI/CD pipelines (GitLab CI or GitHub Actions) for automated testing and deployment

### Out of Scope (DO NOT IMPLEMENT)
- Direct CDN purge or cache invalidation (handled separately)
- DNS management or domain configuration
- Akamai EdgeKV or DataStream operations
- Cross-account or cross-property bulk migrations

## MCP Server Tools (14 tools)

### Read & Analyse
- `get_property_config` — fetch current property rule tree via PAPI
- `read_snippets` — read local config snippet files or list all snippets
- `parse_rule_tree` — parse and structure PAPI JSON into an LLM-optimised representation
- `assemble_rule_tree` — resolve all `#include:` directives into a complete rule tree
- `sync_property` — compare local config against live PAPI version (version-number comparison)

### Validate & Diff
- `validate_config` — check syntax, logic, and PAPI schema compliance (7 local checks + optional API validation)
- `diff_configs` — compare two rule tree versions with behavior/criteria-level granularity

### Write & Ship
- `write_snippet` — create or update a config snippet file on disk with PapiRule validation
- `apply_behavior` — add or modify a single behavior in an existing snippet (in-place replacement)
- `create_branch` — create a git branch following `akamai/<type>/<description>` naming convention
- `create_merge_request` — commit changes, push branch, and open a GitLab/GitHub MR/PR via the API

### Activate & Pipeline
- `activate_staging` — activate property version to Akamai staging network
- `activate_production` — activate property version to production (requires explicit risk acknowledgement)
- `trigger_pipeline` — trigger CI/CD pipeline (GitLab CI or GitHub Actions) for a branch

## Key Conventions
- Agent output = a validated, review-ready GitLab/GitHub merge request/pull request
- MR/PR descriptions must include a plain-English summary of what changed and why
- All changes go through the existing MR/PR approval and pipeline process
- Staging activation is optional; production activation requires explicit user consent and risk acknowledgement

## Tech Stack
- **PAPI** (Akamai Property Manager API) for config operations and activation
- **GitLab API** and **GitHub API** for MR/PR creation and pipeline triggering
- **MCP** (Model Context Protocol) for tool definitions
- **Claude Code** + **VS Code Copilot Chat** as agent surfaces (both via stdio MCP)
