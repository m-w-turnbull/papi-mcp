import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { findPmDirectory, readSnippet } from '../config/snippets.js';
import type { PapiRule, PapiBehavior } from '../papi/types.js';
import { readFile } from 'node:fs/promises';

const REQUIRED_FIELDS = ['name', 'children', 'behaviors', 'criteria', 'criteriaMustSatisfy'];

export interface WriteSnippetParams {
  repoPath: string;
  snippetName: string;
  content: string; // JSON string
  addToMainJson?: boolean;
  position?: 'beginning' | 'end';
}

export interface WriteSnippetResult {
  success: boolean;
  path: string;
  addedToMain: boolean;
}

export async function writeSnippet(params: WriteSnippetParams): Promise<WriteSnippetResult> {
  const { repoPath, snippetName, content, addToMainJson = false, position = 'end' } = params;

  // Parse and validate content
  let rule: PapiRule;
  try {
    rule = JSON.parse(content) as PapiRule;
  } catch {
    throw new Error(`Invalid JSON in snippet content: ${content.slice(0, 100)}...`);
  }

  // Validate required PapiRule fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in rule)) {
      throw new Error(`Missing required field '${field}' in snippet content`);
    }
  }

  // Write snippet file
  const pmDir = await findPmDirectory(repoPath);
  const snippetPath = resolve(pmDir, 'config-snippets', snippetName);
  await writeFile(snippetPath, JSON.stringify(rule, null, 2) + '\n', 'utf-8');

  // Optionally add #include: to main.json
  let addedToMain = false;
  if (addToMainJson) {
    const mainPath = resolve(pmDir, 'config-snippets', 'main.json');
    const mainContent = await readFile(mainPath, 'utf-8');
    const main = JSON.parse(mainContent) as { rules: PapiRule };

    const includeDirective = `#include:${snippetName}`;

    // Check if already included
    const alreadyIncluded = main.rules.children.some(
      c => typeof c === 'string' && c === includeDirective
    );

    if (!alreadyIncluded) {
      if (position === 'beginning') {
        main.rules.children.unshift(includeDirective as unknown as PapiRule);
      } else {
        main.rules.children.push(includeDirective as unknown as PapiRule);
      }
      await writeFile(mainPath, JSON.stringify(main, null, 2) + '\n', 'utf-8');
      addedToMain = true;
    }
  }

  return { success: true, path: snippetPath, addedToMain };
}

// apply_behavior — add or modify a single behavior in an existing snippet

export interface ApplyBehaviorParams {
  repoPath: string;
  snippetName: string;
  behavior: string; // JSON string of PapiBehavior
  criteria?: string; // JSON string of PapiCriteria[]
  criteriaMustSatisfy?: 'all' | 'any';
}

export interface ApplyBehaviorResult {
  success: boolean;
  action: 'added' | 'replaced';
  snippetPath: string;
  before: PapiRule;
  after: PapiRule;
}

export async function applyBehavior(params: ApplyBehaviorParams): Promise<ApplyBehaviorResult> {
  const { repoPath, snippetName, criteriaMustSatisfy } = params;

  // Parse behavior
  let behavior: PapiBehavior;
  try {
    behavior = JSON.parse(params.behavior) as PapiBehavior;
  } catch {
    throw new Error('Invalid JSON in behavior parameter');
  }

  // Read existing snippet
  const snippet = await readSnippet(repoPath, snippetName);
  const before = structuredClone(snippet);

  // Find existing behavior by name
  const existingIdx = snippet.behaviors.findIndex(b => b.name === behavior.name);
  let action: 'added' | 'replaced';

  if (existingIdx >= 0) {
    // Replace in-place
    snippet.behaviors[existingIdx] = behavior;
    action = 'replaced';
  } else {
    // Append
    snippet.behaviors.push(behavior);
    action = 'added';
  }

  // Optionally update criteria
  if (params.criteria) {
    snippet.criteria = JSON.parse(params.criteria);
  }
  if (criteriaMustSatisfy) {
    snippet.criteriaMustSatisfy = criteriaMustSatisfy;
  }

  // Validate and write
  for (const field of REQUIRED_FIELDS) {
    if (!(field in snippet)) {
      throw new Error(`Modified snippet missing required field '${field}'`);
    }
  }

  const pmDir = await findPmDirectory(repoPath);
  const snippetPath = resolve(pmDir, 'config-snippets', snippetName);
  await writeFile(snippetPath, JSON.stringify(snippet, null, 2) + '\n', 'utf-8');

  return { success: true, action, snippetPath, before, after: snippet };
}
