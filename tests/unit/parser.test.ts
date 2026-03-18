import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { parseRuleTree } from '../../src/config/parser.js';

const FIXTURE_PATH = resolve(import.meta.dirname, '../fixtures/sample-property');

describe('parser', () => {
  it('parses from repoPath', async () => {
    const result = await parseRuleTree({ repoPath: FIXTURE_PATH });
    expect(result.totalRules).toBeGreaterThan(1);
    expect(result.totalBehaviors).toBeGreaterThan(0);
    expect(result.variables.length).toBeGreaterThan(0);
  });

  it('produces path breadcrumbs', async () => {
    const result = await parseRuleTree({ repoPath: FIXTURE_PATH });
    const origins = result.rules.find(r => r.name === 'Origins');
    expect(origins).toBeDefined();
    expect(origins!.path).toBe('default > Origins');
  });

  it('includes behavior summaries', async () => {
    const result = await parseRuleTree({ repoPath: FIXTURE_PATH });
    const origins = result.rules.find(r => r.name === 'Origins');
    expect(origins!.behaviors.length).toBeGreaterThan(0);
    expect(origins!.behaviors[0]!.name).toBe('origin');
  });

  it('parses from raw ruleTree JSON', async () => {
    const ruleTree = JSON.stringify({
      rules: {
        name: 'test',
        children: [],
        behaviors: [{ name: 'caching', options: { behavior: 'MAX_AGE', ttl: '1d' } }],
        criteria: [],
        criteriaMustSatisfy: 'all' as const,
      },
    });
    const result = await parseRuleTree({ ruleTree });
    expect(result.totalRules).toBe(1);
    expect(result.rules[0]!.behaviors[0]!.name).toBe('caching');
  });

  it('throws when neither repoPath nor ruleTree provided', async () => {
    await expect(parseRuleTree({})).rejects.toThrow();
  });
});
