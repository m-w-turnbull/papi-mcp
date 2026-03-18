#!/usr/bin/env node

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Redactor, loadRedactionConfig } from './redaction/redactor.js';

// Import Zod schemas from types (plain z.object schemas only — refined schemas need inline shapes)
import {
  GetPropertyConfigSchema,
  ReadSnippetsSchema,
  AssembleRuleTreeSchema,
  SyncPropertySchema,
  ValidateConfigSchema,
  DiffConfigsSchema,
  WriteSnippetSchema,
  ApplyBehaviorSchema,
  CreateBranchSchema,
  CreateMergeRequestSchema,
  TriggerPipelineSchema,
} from './papi/types.js';

// Import tool implementations
import { getPropertyConfig } from './tools/get-property-config.js';
import { listSnippets, readSnippet } from './config/snippets.js';
import { parseRuleTree } from './config/parser.js';
import { assembleRuleTree } from './config/assembler.js';
import { syncProperty } from './tools/sync-property.js';
import { validateLocal } from './validation/local.js';
import { validateWithApi } from './validation/papi.js';
import { diffConfigs } from './tools/diff-configs.js';
import { writeSnippet, applyBehavior } from './tools/write-snippet.js';
import { activateStaging, activateProduction } from './tools/activate.js';
import { triggerPipeline } from './tools/pipeline.js';
import { createBranch, commitAndPush, buildBranchName, getCurrentBranch } from './git/git-ops.js';
import { createProvider } from './git/provider.js';

async function main() {
  const config = await loadRedactionConfig();
  const redactor = new Redactor(config);

  const server = new McpServer({
    name: 'papi-mcp',
    version: '0.1.0',
  });

  // ─── Read & Analyse ──────────────────────────────────────────────

  server.tool(
    'get_property_config',
    'Fetch current property rule tree via the PAPI API. Provide either propertyId or repoPath (which auto-detects from envInfo.json).',
    GetPropertyConfigSchema.shape,
    async (params) => {
      try {
        const result = await getPropertyConfig(params);
        return { content: [{ type: 'text' as const, text: redactor.redact(result) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.tool(
    'read_snippets',
    'Read local config snippet files or list all snippet names. Provide snippetName to read one, or omit to list all.',
    ReadSnippetsSchema.shape,
    async (params) => {
      try {
        if (params.snippetName) {
          const snippet = await readSnippet(params.repoPath, params.snippetName);
          const text = JSON.stringify(redactor.redact(snippet), null, 2);
          return { content: [{ type: 'text' as const, text }] };
        }
        const snippets = await listSnippets(params.repoPath);
        return { content: [{ type: 'text' as const, text: JSON.stringify(snippets, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // ParseRuleTreeSchema uses .refine() — define inline shape
  server.tool(
    'parse_rule_tree',
    'Parse PAPI rule tree JSON into an LLM-optimised flat representation. Provide either repoPath (assembles from disk) or ruleTree (raw JSON string).',
    {
      repoPath: z.string().optional().describe('Path to the property repo (assembles from disk)'),
      ruleTree: z.string().optional().describe('Raw rule tree JSON string'),
    },
    async (params) => {
      try {
        if (!params.repoPath && !params.ruleTree) {
          return { content: [{ type: 'text' as const, text: 'Error: Either repoPath or ruleTree must be provided' }], isError: true };
        }
        const result = await parseRuleTree(params);
        const text = JSON.stringify(redactor.redact(result), null, 2);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.tool(
    'assemble_rule_tree',
    'Resolve all #include: directives into a complete, assembled rule tree from disk.',
    AssembleRuleTreeSchema.shape,
    async (params) => {
      try {
        const result = await assembleRuleTree(params.repoPath);
        const text = JSON.stringify(redactor.redact(result), null, 2);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.tool(
    'sync_property',
    'Compare local config against live PAPI version using version-number comparison.',
    SyncPropertySchema.shape,
    async (params) => {
      try {
        const result = await syncProperty(params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // ─── Validate & Diff ─────────────────────────────────────────────

  server.tool(
    'validate_config',
    'Check syntax, logic, and PAPI schema compliance. Runs 7 local checks; set apiValidation=true to also validate against the PAPI API.',
    ValidateConfigSchema.shape,
    async (params) => {
      try {
        const result = params.apiValidation
          ? await validateWithApi(params.repoPath, { edgercPath: params.edgercPath, edgercSection: params.edgercSection })
          : await validateLocal(params.repoPath);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.tool(
    'diff_configs',
    'Compare two rule tree versions with behavior-level, criteria-level, and variable-level granularity.',
    DiffConfigsSchema.shape,
    async (params) => {
      try {
        const result = diffConfigs(params.before, params.after);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // ─── Write & Ship ────────────────────────────────────────────────

  server.tool(
    'write_snippet',
    'Create or update a config snippet file on disk. Validates PapiRule structure. Optionally adds #include: to main.json.',
    WriteSnippetSchema.shape,
    async (params) => {
      try {
        const result = await writeSnippet(params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.tool(
    'apply_behavior',
    'Add or modify a single behavior in an existing snippet. Replaces in-place if the behavior name already exists.',
    ApplyBehaviorSchema.shape,
    async (params) => {
      try {
        const result = await applyBehavior(params);
        const text = JSON.stringify(redactor.redact(result), null, 2);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.tool(
    'create_branch',
    'Create a git branch following the akamai/<type>/<description> naming convention.',
    CreateBranchSchema.shape,
    async (params) => {
      try {
        const branchName = buildBranchName(params.type, params.description);
        await createBranch(params.repoPath, branchName);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ branch: branchName, created: true }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.tool(
    'create_merge_request',
    'Commit changes, push branch, and open a merge request / pull request via the detected git provider.',
    CreateMergeRequestSchema.shape,
    async (params) => {
      try {
        const branch = await getCurrentBranch(params.repoPath);
        await commitAndPush(params.repoPath, params.title, params.files);
        const provider = await createProvider(params.repoPath);
        const result = await provider.createMergeRequest({
          title: params.title,
          description: params.description,
          sourceBranch: branch,
          targetBranch: params.targetBranch,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // ─── Activate & Pipeline ─────────────────────────────────────────

  // ActivateStagingSchema uses .refine() — define inline shape
  server.tool(
    'activate_staging',
    'Activate a property version to the staging network. Provide either propertyId or repoPath.',
    {
      propertyId: z.string().optional().describe('Akamai property ID'),
      version: z.number().optional().describe('Property version'),
      repoPath: z.string().optional().describe('Path to the property repo'),
      note: z.string().optional().describe('Activation note'),
      edgercPath: z.string().optional().describe('Custom .edgerc file path'),
      edgercSection: z.string().optional().describe('.edgerc section name'),
    },
    async (params) => {
      try {
        if (!params.propertyId && !params.repoPath) {
          return { content: [{ type: 'text' as const, text: 'Error: Either propertyId or repoPath must be provided' }], isError: true };
        }
        const result = await activateStaging(params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // ActivateProductionSchema uses .refine() — define inline shape
  server.tool(
    'activate_production',
    'Activate a property version to production. Requires explicit risk acknowledgement and contact emails.',
    {
      propertyId: z.string().optional().describe('Akamai property ID'),
      version: z.number().optional().describe('Property version'),
      repoPath: z.string().optional().describe('Path to the property repo'),
      acknowledgeProductionRisk: z.literal(true, {
        errorMap: () => ({ message: 'You must set acknowledgeProductionRisk to true for production activation' }),
      }),
      contactEmails: z.array(z.string().email()).min(1).describe('Required notification emails'),
      note: z.string().optional().describe('Activation note'),
      edgercPath: z.string().optional().describe('Custom .edgerc file path'),
      edgercSection: z.string().optional().describe('.edgerc section name'),
    },
    async (params) => {
      try {
        if (!params.propertyId && !params.repoPath) {
          return { content: [{ type: 'text' as const, text: 'Error: Either propertyId or repoPath must be provided' }], isError: true };
        }
        const result = await activateProduction(params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.tool(
    'trigger_pipeline',
    'Trigger a CI/CD pipeline for the specified branch (defaults to current branch).',
    TriggerPipelineSchema.shape,
    async (params) => {
      try {
        const result = await triggerPipeline(params);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
