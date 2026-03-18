import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { findPmDirectory } from '../config/snippets.js';
import type { PapiRule, ValidationCheck, ValidationResult } from '../papi/types.js';

export async function validateLocal(repoPath: string): Promise<ValidationResult> {
  const pmDir = await findPmDirectory(repoPath);
  const snippetsDir = resolve(pmDir, 'config-snippets');

  const checks: ValidationCheck[] = [];

  // Run all 7 checks independently
  checks.push(...await checkJsonSyntax(snippetsDir));
  checks.push(...await checkRequiredFields(snippetsDir));
  checks.push(...await checkIncludeResolution(snippetsDir));
  checks.push(...await checkOrphans(snippetsDir));
  checks.push(...await checkVariableReferences(snippetsDir, pmDir));
  checks.push(...await checkDuplicateRuleNames(snippetsDir));
  checks.push(...await checkNoopRules(snippetsDir));

  return {
    valid: checks.filter(c => c.severity === 'error').length === 0,
    errors: checks.filter(c => c.severity === 'error'),
    warnings: checks.filter(c => c.severity === 'warning'),
    infos: checks.filter(c => c.severity === 'info'),
  };
}

// Check 1: JSON syntax — every .json in config-snippets/ must parse (severity: error)
async function checkJsonSyntax(snippetsDir: string): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];
  const files = await readdir(snippetsDir);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await readFile(resolve(snippetsDir, file), 'utf-8');
      JSON.parse(content);
    } catch (e) {
      checks.push({
        check: 'json-syntax',
        severity: 'error',
        message: `Invalid JSON in ${file}: ${(e as Error).message}`,
        location: file,
      });
    }
  }
  return checks;
}

// Check 2: Required fields — each rule must have: name, children, behaviors, criteria, criteriaMustSatisfy (severity: error)
async function checkRequiredFields(snippetsDir: string): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];
  const required = ['name', 'children', 'behaviors', 'criteria', 'criteriaMustSatisfy'];
  const files = await readdir(snippetsDir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await readFile(resolve(snippetsDir, file), 'utf-8');
      const parsed = JSON.parse(content);
      // main.json has { rules: { ... } } envelope
      const rule = file === 'main.json' ? parsed.rules : parsed;
      if (!rule) continue;

      const checkRule = (r: Record<string, unknown>, path: string) => {
        for (const field of required) {
          if (!(field in r)) {
            checks.push({
              check: 'required-fields',
              severity: 'error',
              message: `Missing required field '${field}' in ${path}`,
              location: `${file}:${path}`,
            });
          }
        }
        // Check children recursively (but only actual objects, not #include strings)
        if (Array.isArray(r['children'])) {
          for (const child of r['children'] as unknown[]) {
            if (typeof child === 'object' && child !== null) {
              checkRule(child as Record<string, unknown>, `${path} > ${(child as { name?: string }).name ?? 'unnamed'}`);
            }
          }
        }
      };

      checkRule(rule, rule.name ?? file);
    } catch {
      // JSON syntax errors handled by check 1
    }
  }
  return checks;
}

// Check 3: Include resolution — every #include: in main.json references an existing file (severity: error)
async function checkIncludeResolution(snippetsDir: string): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];
  try {
    const mainContent = await readFile(resolve(snippetsDir, 'main.json'), 'utf-8');
    const main = JSON.parse(mainContent);
    const rules = main.rules;
    if (!rules?.children) return checks;

    const files = await readdir(snippetsDir);

    const checkIncludes = (children: unknown[], path: string) => {
      for (const child of children) {
        if (typeof child === 'string' && child.startsWith('#include:')) {
          const filename = child.slice('#include:'.length);
          if (!files.includes(filename)) {
            checks.push({
              check: 'include-resolution',
              severity: 'error',
              message: `Include target not found: ${filename}`,
              location: `main.json:${path}`,
            });
          }
        }
      }
    };

    checkIncludes(rules.children, 'default');
  } catch {
    // No main.json or parse error — handled by other checks
  }
  return checks;
}

// Check 4: Orphan detection — snippets not referenced by any #include: (severity: warning)
async function checkOrphans(snippetsDir: string): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];
  try {
    const mainContent = await readFile(resolve(snippetsDir, 'main.json'), 'utf-8');
    const main = JSON.parse(mainContent);
    const rules = main.rules;

    // Collect all referenced includes
    const referenced = new Set<string>();
    const collectIncludes = (children: unknown[]) => {
      for (const child of children) {
        if (typeof child === 'string' && child.startsWith('#include:')) {
          referenced.add(child.slice('#include:'.length));
        }
      }
    };
    if (rules?.children) collectIncludes(rules.children);

    // Check all snippet files
    const files = await readdir(snippetsDir);
    for (const file of files) {
      if (file === 'main.json' || !file.endsWith('.json')) continue;
      if (!referenced.has(file)) {
        checks.push({
          check: 'orphan-detection',
          severity: 'warning',
          message: `Snippet '${file}' is not referenced by any #include: directive`,
          location: file,
        });
      }
    }
  } catch {
    // Handled elsewhere
  }
  return checks;
}

// Check 5: Variable references — {{user.PMUSER_*}} patterns must match declared variables (severity: warning)
async function checkVariableReferences(snippetsDir: string, _pmDir: string): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];
  try {
    // Get declared variables from main.json
    const mainContent = await readFile(resolve(snippetsDir, 'main.json'), 'utf-8');
    const main = JSON.parse(mainContent);
    const declaredVars = new Set<string>();
    if (main.rules?.variables) {
      for (const v of main.rules.variables as { name: string }[]) {
        declaredVars.add(v.name);
      }
    }

    // Scan all snippet files for variable references
    const files = await readdir(snippetsDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const content = await readFile(resolve(snippetsDir, file), 'utf-8');
      const refs = content.match(/\{\{user\.(PMUSER_\w+)\}\}/g);
      if (!refs) continue;

      for (const ref of refs) {
        const varName = ref.match(/\{\{user\.(\w+)\}\}/)![1]!;
        if (!declaredVars.has(varName)) {
          checks.push({
            check: 'variable-references',
            severity: 'warning',
            message: `Variable '${varName}' referenced in ${file} but not declared in main.json variables`,
            location: file,
          });
        }
      }
    }
  } catch {
    // Handled elsewhere
  }
  return checks;
}

// Check 6: Duplicate rule names — sibling rules with same name (severity: warning)
async function checkDuplicateRuleNames(snippetsDir: string): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];
  const files = await readdir(snippetsDir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await readFile(resolve(snippetsDir, file), 'utf-8');
      const parsed = JSON.parse(content);
      const rule = file === 'main.json' ? parsed.rules : parsed;
      if (!rule) continue;

      const checkChildren = (r: { children?: unknown[] }, path: string) => {
        if (!Array.isArray(r.children)) return;
        const names = new Map<string, number>();
        for (const child of r.children) {
          if (typeof child === 'object' && child !== null) {
            const name = (child as { name?: string }).name;
            if (name) {
              names.set(name, (names.get(name) ?? 0) + 1);
            }
          }
        }
        for (const [name, count] of names) {
          if (count > 1) {
            checks.push({
              check: 'duplicate-rule-names',
              severity: 'warning',
              message: `Duplicate rule name '${name}' (${count} occurrences) under ${path}`,
              location: `${file}:${path}`,
            });
          }
        }
        // Recurse
        for (const child of r.children) {
          if (typeof child === 'object' && child !== null) {
            checkChildren(child as { children?: unknown[] }, `${path} > ${(child as { name?: string }).name ?? 'unnamed'}`);
          }
        }
      };

      checkChildren(rule, rule.name ?? file);
    } catch {
      // Handled by syntax check
    }
  }
  return checks;
}

// Check 7: No-op rules — rules with empty behaviors, criteria, AND children (severity: info)
async function checkNoopRules(snippetsDir: string): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];
  const files = await readdir(snippetsDir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await readFile(resolve(snippetsDir, file), 'utf-8');
      const parsed = JSON.parse(content);
      const rule = file === 'main.json' ? parsed.rules : parsed;
      if (!rule) continue;

      const checkNoop = (r: PapiRule, path: string) => {
        const hasNoBehaviors = !r.behaviors || r.behaviors.length === 0;
        const hasNoCriteria = !r.criteria || r.criteria.length === 0;
        const hasNoChildren = !r.children || r.children.length === 0;

        if (hasNoBehaviors && hasNoCriteria && hasNoChildren) {
          checks.push({
            check: 'noop-rules',
            severity: 'info',
            message: `Rule '${r.name}' has no behaviors, criteria, or children`,
            location: `${file}:${path}`,
          });
        }

        // Recurse into children
        if (Array.isArray(r.children)) {
          for (const child of r.children) {
            if (typeof child === 'object' && child !== null) {
              checkNoop(child as PapiRule, `${path} > ${(child as PapiRule).name}`);
            }
          }
        }
      };

      checkNoop(rule as PapiRule, rule.name ?? file);
    } catch {
      // Handled by syntax check
    }
  }
  return checks;
}
