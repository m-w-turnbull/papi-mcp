import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

describe('Tool registration', () => {
  it('server.ts registers all 14 tools', async () => {
    const serverPath = resolve(import.meta.dirname, '../../src/server.ts');
    const content = await readFile(serverPath, 'utf-8');
    const expectedTools = [
      'get_property_config', 'read_snippets', 'parse_rule_tree',
      'assemble_rule_tree', 'sync_property', 'validate_config',
      'diff_configs', 'write_snippet', 'apply_behavior',
      'create_branch', 'create_merge_request',
      'activate_staging', 'activate_production', 'trigger_pipeline',
    ];
    for (const tool of expectedTools) {
      expect(content).toContain(`'${tool}'`);
    }
  });

  it('all tool implementation modules are importable', async () => {
    // These will throw if module resolution fails
    await import('../../src/tools/get-property-config.js');
    await import('../../src/config/snippets.js');
    await import('../../src/config/parser.js');
    await import('../../src/config/assembler.js');
    await import('../../src/tools/sync-property.js');
    await import('../../src/validation/local.js');
    await import('../../src/validation/papi.js');
    await import('../../src/tools/diff-configs.js');
    await import('../../src/tools/write-snippet.js');
    await import('../../src/tools/activate.js');
    await import('../../src/tools/pipeline.js');
    await import('../../src/git/git-ops.js');
    await import('../../src/git/provider.js');
    await import('../../src/redaction/redactor.js');
  });
});
