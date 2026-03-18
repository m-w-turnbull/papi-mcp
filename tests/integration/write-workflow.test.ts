import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { cp, rm } from 'node:fs/promises';
import { writeSnippet, applyBehavior } from '../../src/tools/write-snippet.js';
import { validateLocal } from '../../src/validation/local.js';
import { diffConfigs } from '../../src/tools/diff-configs.js';
import { assembleRuleTree } from '../../src/config/assembler.js';

const FIXTURE_PATH = resolve(import.meta.dirname, '../fixtures/sample-property');
let tmpDir: string;

describe('Write workflow integration', () => {
  beforeEach(async () => {
    tmpDir = resolve(import.meta.dirname, '../fixtures/.tmp-write-integration');
    await cp(FIXTURE_PATH, tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('write → validate → diff end-to-end', async () => {
    // Capture before state
    const beforeTree = await assembleRuleTree(tmpDir);
    const beforeJson = JSON.stringify(beforeTree);

    // Step 1: Write a new snippet
    const newSnippet = JSON.stringify({
      name: 'Security Headers',
      children: [],
      behaviors: [
        {
          name: 'modifyOutgoingResponseHeader',
          options: {
            action: 'ADD',
            standardAddHeaderName: 'OTHER',
            customHeaderName: 'X-Frame-Options',
            headerValue: 'DENY',
          },
        },
      ],
      criteria: [],
      criteriaMustSatisfy: 'all',
    });

    const writeResult = await writeSnippet({
      repoPath: tmpDir,
      snippetName: 'Security_Headers.json',
      content: newSnippet,
      addToMainJson: true,
      position: 'end',
    });
    expect(writeResult.success).toBe(true);
    expect(writeResult.addedToMain).toBe(true);

    // Step 2: Validate
    const validation = await validateLocal(tmpDir);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);

    // Step 3: Diff before vs after
    const afterTree = await assembleRuleTree(tmpDir);
    const afterJson = JSON.stringify(afterTree);
    const diff = diffConfigs(beforeJson, afterJson);
    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.rulesAdded).toBeGreaterThan(0);
  });

  it('apply_behavior modifies existing snippet correctly', async () => {
    const result = await applyBehavior({
      repoPath: tmpDir,
      snippetName: 'Performance.json',
      behavior: JSON.stringify({
        name: 'caching',
        options: { behavior: 'NO_STORE' },
      }),
    });
    expect(result.action).toBe('replaced');

    // Validate still passes
    const validation = await validateLocal(tmpDir);
    expect(validation.valid).toBe(true);
  });
});
