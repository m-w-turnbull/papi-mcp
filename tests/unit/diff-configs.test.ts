import { describe, it, expect } from 'vitest';
import { diffConfigs } from '../../src/tools/diff-configs.js';

describe('diffConfigs', () => {
  const baseConfig = {
    rules: {
      name: 'default',
      children: [],
      behaviors: [
        { name: 'caching', options: { behavior: 'MAX_AGE', ttl: '7d' } },
        { name: 'origin', options: { hostname: 'origin.example.com' } },
      ],
      criteria: [],
      criteriaMustSatisfy: 'all' as const,
      variables: [
        { name: 'PMUSER_HOST', value: 'example.com', description: '', hidden: false, sensitive: false },
      ],
    },
  };

  it('detects no changes for identical configs', () => {
    const json = JSON.stringify(baseConfig);
    const result = diffConfigs(json, json);
    expect(result.hasChanges).toBe(false);
    expect(result.changes.length).toBe(0);
  });

  it('detects added behavior', () => {
    const after = structuredClone(baseConfig);
    after.rules.behaviors.push({ name: 'http2', options: { enabled: true } });
    const result = diffConfigs(JSON.stringify(baseConfig), JSON.stringify(after));
    expect(result.hasChanges).toBe(true);
    expect(result.summary.behaviorsAdded).toBe(1);
  });

  it('detects removed behavior', () => {
    const after = structuredClone(baseConfig);
    after.rules.behaviors = after.rules.behaviors.filter(b => b.name !== 'origin');
    const result = diffConfigs(JSON.stringify(baseConfig), JSON.stringify(after));
    expect(result.hasChanges).toBe(true);
    expect(result.summary.behaviorsRemoved).toBe(1);
  });

  it('detects modified behavior options', () => {
    const after = structuredClone(baseConfig);
    after.rules.behaviors[0]!.options['ttl'] = '1d';
    const result = diffConfigs(JSON.stringify(baseConfig), JSON.stringify(after));
    expect(result.hasChanges).toBe(true);
    expect(result.summary.behaviorsModified).toBe(1);
  });

  it('detects added variable', () => {
    const after = structuredClone(baseConfig);
    after.rules.variables!.push({ name: 'PMUSER_KEY', value: 'val', description: '', hidden: false, sensitive: false });
    const result = diffConfigs(JSON.stringify(baseConfig), JSON.stringify(after));
    expect(result.summary.variablesAdded).toBe(1);
  });

  it('detects removed variable', () => {
    const after = structuredClone(baseConfig);
    after.rules.variables = [];
    const result = diffConfigs(JSON.stringify(baseConfig), JSON.stringify(after));
    expect(result.summary.variablesRemoved).toBe(1);
  });

  it('generates unified diff', () => {
    const after = structuredClone(baseConfig);
    after.rules.behaviors[0]!.options['ttl'] = '1d';
    const result = diffConfigs(JSON.stringify(baseConfig), JSON.stringify(after));
    expect(result.unifiedDiff).toContain('---');
    expect(result.unifiedDiff).toContain('+++');
  });

  it('detects added/removed child rules', () => {
    const before = structuredClone(baseConfig);
    before.rules.children = [
      { name: 'Rule A', children: [], behaviors: [{ name: 'caching', options: {} }], criteria: [], criteriaMustSatisfy: 'all' as const },
    ] as any;
    const after = structuredClone(before);
    (after.rules.children as any[]).push(
      { name: 'Rule B', children: [], behaviors: [{ name: 'origin', options: {} }], criteria: [], criteriaMustSatisfy: 'all' as const }
    );
    const result = diffConfigs(JSON.stringify(before), JSON.stringify(after));
    expect(result.summary.rulesAdded).toBe(1);
  });
});
