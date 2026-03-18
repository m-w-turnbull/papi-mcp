import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { findPmDirectory } from './snippets.js';
import type { PapiRule, RuleTree } from '../papi/types.js';

export class AssemblerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssemblerError';
  }
}

export async function assembleRuleTree(repoPath: string): Promise<RuleTree> {
  const pmDir = await findPmDirectory(repoPath);
  const mainPath = resolve(pmDir, 'config-snippets', 'main.json');

  const mainContent = await readFile(mainPath, 'utf-8');
  const mainJson = JSON.parse(mainContent) as { rules: PapiRule };

  // main.json has the { rules: { ... } } envelope
  const rootRule = mainJson.rules;

  // Resolve #include: directives in children
  const snippetsDir = resolve(pmDir, 'config-snippets');
  const resolved = await resolveIncludes(rootRule, snippetsDir, new Set<string>());

  return {
    rules: resolved,
    ruleFormat: undefined, // Will come from envInfo if needed
  };
}

async function resolveIncludes(
  rule: PapiRule,
  snippetsDir: string,
  visited: Set<string>,
): Promise<PapiRule> {
  const resolvedChildren: PapiRule[] = [];

  for (const child of rule.children) {
    if (typeof child === 'string' && child.startsWith('#include:')) {
      const filename = child.slice('#include:'.length);

      if (visited.has(filename)) {
        throw new AssemblerError(
          `Circular include detected: ${filename} (chain: ${[...visited].join(' → ')} → ${filename})`,
        );
      }

      const filePath = resolve(snippetsDir, filename);
      let content: string;
      try {
        content = await readFile(filePath, 'utf-8');
      } catch {
        throw new AssemblerError(
          `Missing include target: ${filename} (expected at ${filePath})`,
        );
      }

      const snippet = JSON.parse(content) as PapiRule;
      visited.add(filename);
      const resolved = await resolveIncludes(snippet, snippetsDir, visited);
      visited.delete(filename);
      resolvedChildren.push(resolved);
    } else if (typeof child === 'object') {
      resolvedChildren.push(
        await resolveIncludes(child as PapiRule, snippetsDir, visited),
      );
    }
  }

  return {
    ...rule,
    children: resolvedChildren,
  };
}
