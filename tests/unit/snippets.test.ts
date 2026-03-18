import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { findPmDirectory, listSnippets, readSnippet, readAllSnippets, readMetadata } from '../../src/config/snippets.js';

const FIXTURE_PATH = resolve(import.meta.dirname, '../fixtures/sample-property');

describe('snippets', () => {
  it('finds property directory with config-snippets', async () => {
    const pmDir = await findPmDirectory(FIXTURE_PATH);
    expect(pmDir).toContain('prop');
  });

  it('lists all snippet files', async () => {
    const snippets = await listSnippets(FIXTURE_PATH);
    expect(snippets).toContain('main.json');
    expect(snippets).toContain('Origins.json');
    expect(snippets).toContain('CORS_Policy.json');
    expect(snippets).toContain('Performance.json');
    expect(snippets.length).toBeGreaterThanOrEqual(4);
  });

  it('reads a specific snippet', async () => {
    const snippet = await readSnippet(FIXTURE_PATH, 'Origins.json');
    expect(snippet.name).toBe('Origins');
    expect(snippet.behaviors.length).toBeGreaterThan(0);
  });

  it('reads all snippets into a map', async () => {
    const all = await readAllSnippets(FIXTURE_PATH);
    expect(all.size).toBeGreaterThanOrEqual(4);
    expect(all.has('Origins.json')).toBe(true);
  });

  it('reads metadata files', async () => {
    const meta = await readMetadata(FIXTURE_PATH);
    expect(meta.envInfo.propertyId).toBe(12345);
    expect(meta.projectInfo.name).toBe('my-property');
    expect(meta.hostnames.length).toBe(2);
  });

  it('throws for missing directory', async () => {
    await expect(findPmDirectory('/nonexistent')).rejects.toThrow();
  });
});
