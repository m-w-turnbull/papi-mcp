# Akamai Property Configuration

This project uses the papi-mcp MCP server for AI-assisted Akamai property management.

## Available Tools

14 tools across read, validate, write, activate, and pipeline workflows.

### Read & Analyse

- `get_property_config` — Fetch current property rule tree from PAPI API
- `read_snippets` — List or read config snippet files from disk
- `parse_rule_tree` — Convert JSON rule tree to LLM-optimised representation
- `assemble_rule_tree` — Resolve all #include: directives into complete tree
- `sync_property` — Compare local config against live PAPI version

### Validate & Diff

- `validate_config` — Run 7 validation checks + optional PAPI API validation
- `diff_configs` — Structured diff between two rule tree versions

### Write & Ship

- `write_snippet` — Create or update config snippet files
- `apply_behavior` — Add or modify single behavior in a snippet
- `create_branch` — Create git branch with akamai/ naming convention
- `create_merge_request` — Commit, push, and open MR/PR

### Activate & Pipeline

- `activate_staging` — Activate property to staging network
- `activate_production` — Activate to production (requires risk acknowledgement)
- `trigger_pipeline` — Trigger CI/CD pipeline for current branch

## Recommended Workflow

1. **Understand**: `read_snippets` → `parse_rule_tree` to get overview
2. **Branch**: `create_branch` with type and description
3. **Modify**: `write_snippet` or `apply_behavior` to make changes
4. **Validate**: `validate_config` to check for issues
5. **Review**: `diff_configs` to see what changed
6. **Ship**: `create_merge_request` to open MR/PR
7. **Activate** (after MR approval):
   - `activate_staging` to test on staging first
   - `activate_production` with acknowledgeProductionRisk and contactEmails

## Configuration

### Akamai Credentials

Use `.edgerc` file (default location: `~/.edgerc`):

```ini
[default]
client_secret = xxx
host = xxx.luna.akamaiapis.net
access_token = xxx
client_token = xxx
```

Or set environment variables:

```bash
export AKAMAI_CLIENT_SECRET=xxx
export AKAMAI_HOST=xxx.luna.akamaiapis.net
export AKAMAI_ACCESS_TOKEN=xxx
export AKAMAI_CLIENT_TOKEN=xxx
```

### Redaction Config (.papi-mcp.json)

Configure sensitive field redaction:

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

### Git Provider

Auto-detected from git remote. Override in `.papi-mcp.json` if needed.

- **GitLab**: Requires `GITLAB_TOKEN`, `GITLAB_PERSONAL_ACCESS_TOKEN`, or `CI_JOB_TOKEN`
- **GitHub**: Requires `GITHUB_TOKEN` or `GH_TOKEN`

### Property Metadata

Auto-detected from `envInfo.json` in property repo:

```json
{
  "propertyId": "prp_12345",
  "groupId": "grp_54321",
  "networkType": "production"
}
```

## Best Practices

- Start with `parse_rule_tree` to understand current configuration
- Use descriptive snippet names: `CORS_Policy.json`, `API_Caching.json`
- Use variables for environment-specific values
- Validate after every change
- Review diffs before creating MRs
- Test on staging before production activation
- Include detailed descriptions in MRs explaining the why of changes
