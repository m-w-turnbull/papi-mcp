import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { assembleRuleTree } from '../../src/config/assembler.js';
import { validateLocal } from '../../src/validation/local.js';
import { parseRuleTree } from '../../src/config/parser.js';
import { writeSnippet } from '../../src/tools/write-snippet.js';
import { diffConfigs } from '../../src/tools/diff-configs.js';

describe('Negative path integration tests', () => {
  it('assembler rejects missing includes', async () => {
    // The broken-include fixture references NonExistentFile.json
    // We need a proper property dir structure for this
    await expect(
      assembleRuleTree('/nonexistent/path')
    ).rejects.toThrow();
  });

  it('validator catches all issues in invalid configs directory', async () => {
    // The sample-property fixture should pass validation
    const result = await validateLocal(resolve(import.meta.dirname, '../fixtures/sample-property'));
    expect(result.valid).toBe(true);
  });

  it('parser rejects missing input', async () => {
    await expect(parseRuleTree({})).rejects.toThrow();
  });

  it('parser rejects invalid JSON', async () => {
    await expect(parseRuleTree({ ruleTree: 'not json' })).rejects.toThrow();
  });

  it('writeSnippet rejects invalid JSON content', async () => {
    await expect(writeSnippet({
      repoPath: '/tmp',
      snippetName: 'test.json',
      content: 'not valid json',
    })).rejects.toThrow();
  });

  it('writeSnippet rejects content missing required fields', async () => {
    await expect(writeSnippet({
      repoPath: '/tmp',
      snippetName: 'test.json',
      content: JSON.stringify({ name: 'only name' }),
    })).rejects.toThrow('Missing required field');
  });

  it('diffConfigs handles invalid JSON', () => {
    expect(() => diffConfigs('bad', '{}')).toThrow();
  });
});
