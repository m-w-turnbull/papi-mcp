# Akamai PAPI MCP Tools

You have access to 14 Akamai Property Manager tools via the papi-mcp MCP server.

## Tool Categories

### Read & Analyse (5 tools)

- `get_property_config` — Fetch current property rule tree from PAPI API
- `read_snippets` — List or read config snippet files from disk
- `parse_rule_tree` — Convert JSON rule tree to human-readable representation
- `assemble_rule_tree` — Resolve all #include: directives into complete tree
- `sync_property` — Compare local config against live PAPI version

### Validate & Diff (2 tools)

- `validate_config` — Run 7 validation checks + optional PAPI API validation
- `diff_configs` — Structured diff between two rule tree versions

### Write & Ship (4 tools)

- `write_snippet` — Create or update config snippet files
- `apply_behavior` — Add or modify single behavior in a snippet
- `create_branch` — Create git branch with akamai/ naming convention
- `create_merge_request` — Commit, push, and open MR/PR

### Activate & Pipeline (3 tools)

- `activate_staging` — Activate property to staging network
- `activate_production` — Activate to production (requires risk acknowledgement)
- `trigger_pipeline` — Trigger CI/CD pipeline for current branch

## Recommended Workflow

Always follow this sequence:

1. **Read & Parse**: Understand current configuration
   - `read_snippets` to list files
   - `parse_rule_tree` to get overview

2. **Plan**: Create a feature branch
   - `create_branch` with type (feature/fix/chore) and description

3. **Modify**: Make your changes
   - `write_snippet` to create/update files
   - `apply_behavior` to modify specific behaviors

4. **Validate**: Check for issues
   - `validate_config` to run all checks

5. **Review**: See what changed
   - `diff_configs` to compare versions

6. **Ship**: Open for review
   - `create_merge_request` to commit and open MR/PR

7. **Activate** (after approval):
   - `activate_staging` to test on staging
   - `activate_production` to go live

## Safety Guidelines

- **Always activate staging first** before production
- Production activation requires:
  - `acknowledgeProductionRisk: true`
  - At least one email in `contactEmails`
- **Always validate** before creating MRs
- **Always review diffs** before shipping changes

## Configuration

Make sure you have:

1. `.edgerc` with Akamai credentials OR env vars
2. `.papi-mcp.json` for redaction rules (optional)
3. Git remote configured (GitLab or GitHub)

See project CLAUDE.md for detailed setup.
