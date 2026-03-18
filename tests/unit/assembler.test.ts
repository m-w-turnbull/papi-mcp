import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { assembleRuleTree } from '../../src/config/assembler.js';

const FIXTURE_PATH = resolve(import.meta.dirname, '../fixtures/sample-property');

describe('assembler', () => {
  it('assembles rule tree from fixture', async () => {
    const tree = await assembleRuleTree(FIXTURE_PATH);
    expect(tree.rules.name).toBe('default');
    // Should resolve 3 includes into actual rule objects
    expect(tree.rules.children.length).toBe(3);
    expect(typeof tree.rules.children[0]).toBe('object');
    const firstChild = tree.rules.children[0] as { name: string };
    expect(firstChild.name).toBe('Origins');
  });

  it('preserves variables from root', async () => {
    const tree = await assembleRuleTree(FIXTURE_PATH);
    expect(tree.rules.variables).toBeDefined();
    expect(tree.rules.variables!.length).toBeGreaterThan(0);
  });

  it('preserves behaviors in snippets', async () => {
    const tree = await assembleRuleTree(FIXTURE_PATH);
    const origins = tree.rules.children[0] as { behaviors: { name: string }[] };
    expect(origins.behaviors.some(b => b.name === 'origin')).toBe(true);
  });
});
