# Publishing to MCP Registries

Guide for publishing `@mwturnbull/papi-mcp` to MCP server registries.

## 1. mcp.so — Web Form (~2 min)

Submit at [mcp.so/submit](https://mcp.so/submit):

- **Type:** MCP Server
- **Name:** Akamai PAPI MCP
- **URL:** `https://www.npmjs.com/package/@mwturnbull/papi-mcp` or GitHub repo URL

No PR or CLI needed — just a web form.

## 2. Official MCP Registry — CLI Publish (~20 min)

The `modelcontextprotocol/servers` GitHub repo **no longer accepts community PRs**. Use the `mcp-publisher` CLI instead.

### Steps

1. **Add `mcpName` to `package.json`:**
   ```json
   {
     "mcpName": "io.github.mwturnbull/papi-mcp"
   }
   ```

2. **Install the publisher:**
   ```bash
   curl -fsSL https://install.mcp-publisher.dev | sh
   ```

3. **Generate `server.json`:**
   ```bash
   mcp-publisher init
   ```
   This auto-populates from `package.json`. The generated file should include:
   - Server name, title, description, version
   - Repository URL
   - npm package info and transport type (`stdio`)
   - Environment variables (`AKAMAI_CLIENT_TOKEN`, `AKAMAI_CLIENT_SECRET`, `AKAMAI_ACCESS_TOKEN`, `AKAMAI_HOST`)

4. **Authenticate via GitHub:**
   ```bash
   mcp-publisher login github
   ```

5. **Publish:**
   ```bash
   mcp-publisher publish
   ```

6. **Verify:**
   ```bash
   curl https://registry.modelcontextprotocol.io/servers/io.github.mwturnbull/papi-mcp
   ```

### Namespace Rules
The registry enforces that `io.github.mwturnbull/*` can only be published by the authenticated GitHub user `mwturnbull`.

## 3. Smithery — CLI Publish (~10 min)

### Steps

1. **Install CLI:**
   ```bash
   npm install -g @smithery/cli
   ```

2. **Publish:**
   ```bash
   smithery mcp publish --name @mwturnbull/papi-mcp --transport stdio
   ```

3. **If your server requires configuration (API keys, etc.):**
   ```bash
   smithery mcp publish --name @mwturnbull/papi-mcp --transport stdio \
     --config-schema '{"type":"object","properties":{"apiKey":{"type":"string"}}}'
   ```

Smithery auto-scans your server to extract tool names and descriptions.

## Recommended Order

| # | Registry | Reason |
|---|----------|--------|
| 1 | mcp.so | Trivial, instant visibility |
| 2 | MCP Registry | Official Anthropic-backed, most authoritative |
| 3 | Smithery | Additional discoverability |

## References

- [mcp.so submit form](https://mcp.so/submit)
- [MCP Registry GitHub](https://github.com/modelcontextprotocol/registry)
- [MCP Registry quickstart](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx)
- [Smithery publish docs](https://smithery.ai/docs/build/publish.md)
- [Smithery CLI docs](https://smithery.ai/docs/concepts/cli.md)
