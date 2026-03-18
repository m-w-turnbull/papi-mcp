import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { cp, rm, readFile } from 'node:fs/promises';
import { writeSnippet, applyBehavior } from '../../src/tools/write-snippet.js';

const FIXTURE_PATH = resolve(import.meta.dirname, '../fixtures/sample-property');
let tmpDir: string;

describe('writeSnippet', () => {
  beforeEach(async () => {
    tmpDir = resolve(import.meta.dirname, '../fixtures/.tmp-write-test');
    await cp(FIXTURE_PATH, tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a new snippet file', async () => {
    const content = JSON.stringify({
      name: 'New Rule',
      children: [],
      behaviors: [{ name: 'caching', options: { behavior: 'NO_STORE' } }],
      criteria: [],
      criteriaMustSatisfy: 'all',
    });
    const result = await writeSnippet({
      repoPath: tmpDir,
      snippetName: 'NewRule.json',
      content,
    });
    expect(result.success).toBe(true);
    // Verify file exists
    const written = await readFile(result.path, 'utf-8');
    expect(JSON.parse(written).name).toBe('New Rule');
  });

  it('adds include to main.json', async () => {
    const content = JSON.stringify({
      name: 'Added Rule',
      children: [],
      behaviors: [],
      criteria: [],
      criteriaMustSatisfy: 'all',
    });
    const result = await writeSnippet({
      repoPath: tmpDir,
      snippetName: 'Added.json',
      content,
      addToMainJson: true,
      position: 'end',
    });
    expect(result.addedToMain).toBe(true);

    // Verify main.json has the include
    const mainPath = resolve(tmpDir, 'prop/config-snippets/main.json');
    const mainContent = JSON.parse(await readFile(mainPath, 'utf-8'));
    const lastChild = mainContent.rules.children[mainContent.rules.children.length - 1];
    expect(lastChild).toBe('#include:Added.json');
  });

  it('rejects invalid JSON content', async () => {
    await expect(writeSnippet({
      repoPath: tmpDir,
      snippetName: 'Bad.json',
      content: 'not json',
    })).rejects.toThrow('Invalid JSON');
  });

  it('rejects content missing required fields', async () => {
    await expect(writeSnippet({
      repoPath: tmpDir,
      snippetName: 'Bad.json',
      content: JSON.stringify({ name: 'only name' }),
    })).rejects.toThrow('Missing required field');
  });
});

describe('applyBehavior', () => {
  beforeEach(async () => {
    tmpDir = resolve(import.meta.dirname, '../fixtures/.tmp-write-test');
    await cp(FIXTURE_PATH, tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('adds new behavior to snippet', async () => {
    const result = await applyBehavior({
      repoPath: tmpDir,
      snippetName: 'Origins.json',
      behavior: JSON.stringify({ name: 'http2', options: { enabled: true } }),
    });
    expect(result.action).toBe('added');
    expect(result.after.behaviors.some(b => b.name === 'http2')).toBe(true);
  });

  it('replaces existing behavior by name', async () => {
    const result = await applyBehavior({
      repoPath: tmpDir,
      snippetName: 'Performance.json',
      behavior: JSON.stringify({ name: 'caching', options: { behavior: 'NO_STORE' } }),
    });
    expect(result.action).toBe('replaced');
    const caching = result.after.behaviors.find(b => b.name === 'caching');
    expect(caching!.options['behavior']).toBe('NO_STORE');
  });
});
