# papi-mcp

MCP server for Akamai Property Manager (PAPI) configurations. Gives AI assistants structured access to read, validate, modify, and activate Akamai CDN properties.

## Features

- **14 tools** across read, validate, write, activate, and pipeline workflows
- **Config-driven redaction** — no hardcoded secrets
- **GitLab + GitHub** — pluggable git provider with auto-detection
- **Activation safety** — staging/production split with explicit risk acknowledgement
- **7 local validation checks** + optional PAPI API validation
- **LLM-optimized parsing** — flat, breadcrumb-based rule tree representation
- **Snippet-based configs** — large rule trees split with #include: directives

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Claude Code

Add to your MCP settings (`.cursor/claude_config.json` or Claude settings):

```json
{
  "mcpServers": {
    "papi-mcp": {
      "command": "node",
      "args": ["path/to/papi-mcp/dist/server.js"]
    }
  }
}
```

### VS Code Copilot Chat

Add the same MCP configuration to your VS Code settings.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "papi-mcp": {
      "command": "node",
      "args": ["path/to/papi-mcp/dist/server.js"]
    }
  }
}
```

## Tools

### Read & Analyse (5 tools)

| Tool | Description |
|------|-------------|
| `get_property_config` | Fetch current property rule tree via PAPI API. Requires `propertyId` or auto-detects from `envInfo.json` in repo. |
| `read_snippets` | Read local config snippet files or list all snippets. Snippets live in `config-snippets/` directory. |
| `parse_rule_tree` | Parse PAPI JSON into LLM-optimised flat representation. Accepts either `repoPath` (assembles from disk) or raw `ruleTree` JSON. |
| `assemble_rule_tree` | Resolve all #include: directives into a complete rule tree. Validates that all includes exist. |
| `sync_property` | Compare local config against live PAPI version using version-number comparison. |

### Validate & Diff (2 tools)

| Tool | Description |
|------|-------------|
| `validate_config` | Run 7 validation checks: JSON syntax, required fields, include resolution, orphan detection, variable references, duplicate names, no-op rules. Optional `apiValidation: true` for PAPI schema compliance. |
| `diff_configs` | Structured diff between two rule tree versions. Shows behavior-level and criteria-level changes. |

### Write & Ship (4 tools)

| Tool | Description |
|------|-------------|
| `write_snippet` | Create or update a config snippet file. Validates against PapiRule schema. |
| `apply_behavior` | Add or modify a single behavior in an existing snippet. Useful for targeted changes. |
| `create_branch` | Create git branch following `akamai/<type>/<description>` naming convention. Types: feature, fix, refactor, chore. |
| `create_merge_request` | Commit changes, push branch, and open a GitLab MR or GitHub PR. Auto-detects git provider. |

### Activate & Pipeline (3 tools)

| Tool | Description |
|------|-------------|
| `activate_staging` | Activate property version to Akamai staging network. Returns immediately; check status via polling. |
| `activate_production` | Activate to production. Requires `acknowledgeProductionRisk: true` and at least one `contactEmails` entry. |
| `trigger_pipeline` | Trigger CI/CD pipeline for current branch. Useful for automated testing. |

## Configuration

### Akamai Credentials

Option 1: `.edgerc` file (default location: `~/.edgerc`):

```ini
[default]
client_secret = xxxx
host = xxxx.luna.akamaiapis.net
access_token = xxxx
client_token = xxxx
```

Option 2: Environment variables:

```bash
export AKAMAI_CLIENT_SECRET=xxxx
export AKAMAI_HOST=xxxx.luna.akamaiapis.net
export AKAMAI_ACCESS_TOKEN=xxxx
export AKAMAI_CLIENT_TOKEN=xxxx
```

Get credentials from Akamai Control Center or ask your team administrator.

### Redaction Config (.papi-mcp.json)

Create `.papi-mcp.json` in your project root to configure sensitive field redaction:

```json
{
  "redact": {
    "sensitiveVariables": true,
    "fields": ["options.hostname", "options.headerValue"],
    "sensitiveHeaders": ["authorization", "x-api-key"]
  },
  "gitProvider": {
    "type": "gitlab",
    "host": "gitlab.internal.example.com"
  }
}
```

Redaction prevents secrets from appearing in logs and AI outputs.

### Git Provider

Auto-detected from git remote URL. Override in `.papi-mcp.json` for custom domains.

**GitLab:**

Set one of: `GITLAB_TOKEN`, `GITLAB_PERSONAL_ACCESS_TOKEN`, or `CI_JOB_TOKEN`

```bash
export GITLAB_TOKEN=glpat-xxxx
```

**GitHub:**

Set one of: `GITHUB_TOKEN` or `GH_TOKEN`

```bash
export GITHUB_TOKEN=ghp_xxxx
```

### Property Metadata (envInfo.json)

Auto-detected from property repo structure. Place in `{propertyName}/envInfo.json`:

```json
{
  "name": "my-property",
  "propertyId": 12345,
  "propertyName": "my-property",
  "groupId": 67890,
  "isSecure": false,
  "latestVersionInfo": {
    "propertyVersion": 5,
    "productionStatus": "ACTIVE",
    "stagingStatus": "ACTIVE",
    "ruleFormat": "v2024-02-12"
  }
}
```

## Recommended Workflow

1. **Understand current state**: `read_snippets` → `parse_rule_tree`
2. **Create branch**: `create_branch` with type and description
3. **Make changes**: `write_snippet` or `apply_behavior`
4. **Validate**: `validate_config` to check for issues
5. **Review changes**: `diff_configs` to compare
6. **Open for review**: `create_merge_request` to create MR/PR
7. **After approval, activate**:
   - `activate_staging` to test on staging
   - `activate_production` to go live

## Architecture

```
src/
├── server.ts                    # MCP server entry (14 tool registrations)
├── papi/
│   ├── types.ts                # Zod schemas and TypeScript types
│   ├── auth.ts                 # EdgeGrid credential resolution
│   └── client.ts               # PAPI HTTP client
├── config/
│   ├── snippets.ts             # Snippet file I/O operations
│   ├── assembler.ts            # #include: directive resolution
│   └── parser.ts               # LLM-optimized rule tree parser
├── validation/
│   ├── local.ts                # 7 local validation checks
│   └── papi.ts                 # PAPI API validation wrapper
├── tools/
│   ├── get-property-config.ts  # Fetch property from PAPI
│   ├── read-snippets.ts        # Read local config files
│   ├── diff-configs.ts         # Structured config diffing
│   ├── sync-property.ts        # Local vs live comparison
│   ├── write-snippet.ts        # Create/update config files
│   ├── activate.ts             # Staging/production activation
│   └── pipeline.ts             # CI/CD pipeline triggering
├── git/
│   ├── git-ops.ts              # Core git operations
│   ├── provider.ts             # GitProvider interface + factory
│   ├── gitlab.ts               # GitLab API client
│   └── github.ts               # GitHub API client
├── redaction/
│   └── redactor.ts             # Config-driven field redaction
└── skill/
    └── system-prompt.md        # AI domain knowledge layer
```

## Development

```bash
npm install              # Install dependencies
npm run build            # TypeScript compilation
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run dev              # Dev mode with tsx
npm run lint             # Type checking
```

## Testing

Run the full test suite:

```bash
npm test
```

Watch mode for development:

```bash
npm run test:watch
```

Coverage report:

```bash
npm run test:coverage
```

Test fixtures are in `tests/fixtures/`:

- `sample-property/` — valid property configuration with snippets
- `api-responses/` — mock PAPI API responses
- `invalid-configs/` — invalid configs for validation testing

## Best Practices

- Use descriptive snippet names: `CORS_Policy.json`, `API_Caching.json`, `Origins.json`
- Use variables for environment-specific values (hostnames, API keys)
- Mark sensitive variables as `hidden: true, sensitive: true`
- Run validation after every change
- Review diffs before creating merge requests
- Always activate staging before production
- Document rule purposes in rule names
- Group related rules under descriptive parent rules

## Validation Checks

The `validate_config` tool runs 7 checks:

1. **JSON syntax** — all files must be valid JSON (error)
2. **Required fields** — name, children, behaviors, criteria, criteriaMustSatisfy (error)
3. **Include resolution** — all #include: targets must exist (error)
4. **Orphan detection** — unreferenced snippets (warning)
5. **Variable references** — PMUSER_ vars must be declared (warning)
6. **Duplicate rule names** — siblings with same name (warning)
7. **No-op rules** — empty behaviors + criteria + children (info)

Use `apiValidation: true` to also check PAPI schema compliance.

## Troubleshooting

### Credentials Not Found

Make sure one of:

- `~/.edgerc` exists with [default] section
- Environment variables are set: `AKAMAI_CLIENT_SECRET`, `AKAMAI_HOST`, `AKAMAI_ACCESS_TOKEN`, `AKAMAI_CLIENT_TOKEN`

### Property Not Found

Verify:

- `propertyId` is correct (e.g., `prp_12345`)
- `groupId` is correct (auto-detected from `envInfo.json`)
- Account has access to the property

### Git Provider Not Detected

Make sure:

- Git remote is set: `git remote -v`
- Git token is set: `GITLAB_TOKEN` or `GITHUB_TOKEN`
- `.papi-mcp.json` is configured if using custom domain

### Validation Errors

Run `validate_config` with `apiValidation: true` to get PAPI schema validation details.

## License

MIT
