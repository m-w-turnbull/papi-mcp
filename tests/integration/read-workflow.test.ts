import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { listSnippets, readAllSnippets } from '../../src/config/snippets.js';
import { assembleRuleTree } from '../../src/config/assembler.js';
import { parseRuleTree } from '../../src/config/parser.js';

const FIXTURE_PATH = resolve(import.meta.dirname, '../fixtures/sample-property');

describe('Read workflow integration', () => {
  it('reads snippets → assembles → parses end-to-end', async () => {
    // Step 1: List and read snippets
    const snippetNames = await listSnippets(FIXTURE_PATH);
    expect(snippetNames.length).toBeGreaterThanOrEqual(4);

    const allSnippets = await readAllSnippets(FIXTURE_PATH);
    expect(allSnippets.size).toBeGreaterThanOrEqual(4);

    // Step 2: Assemble complete rule tree
    const tree = await assembleRuleTree(FIXTURE_PATH);
    expect(tree.rules.name).toBe('default');
    expect(tree.rules.children.length).toBe(3);
    // All includes should be resolved to objects
    for (const child of tree.rules.children) {
      expect(typeof child).toBe('object');
    }

    // Step 3: Parse into LLM-friendly format
    const parsed = await parseRuleTree({ repoPath: FIXTURE_PATH });
    expect(parsed.totalRules).toBeGreaterThan(1);
    expect(parsed.totalBehaviors).toBeGreaterThan(0);
    expect(parsed.variables.length).toBeGreaterThan(0);

    // Verify breadcrumbs are correct
    const origins = parsed.rules.find(r => r.name === 'Origins');
    expect(origins).toBeDefined();
    expect(origins!.path).toBe('default > Origins');
    expect(origins!.behaviors[0]!.name).toBe('origin');
  });

  it('parse works with raw JSON input too', async () => {
    const tree = await assembleRuleTree(FIXTURE_PATH);
    const json = JSON.stringify(tree);
    const parsed = await parseRuleTree({ ruleTree: json });
    expect(parsed.totalRules).toBeGreaterThan(0);
  });
});
