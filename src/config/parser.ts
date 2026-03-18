import type { PapiRule, ParsedRule, ParsedRuleTree } from '../papi/types.js';
import { assembleRuleTree } from './assembler.js';

export async function parseRuleTree(options: {
  repoPath?: string;
  ruleTree?: string;
}): Promise<ParsedRuleTree> {
  let rootRule: PapiRule;
  let ruleFormat: string | undefined;

  if (options.repoPath) {
    const tree = await assembleRuleTree(options.repoPath);
    rootRule = tree.rules;
    ruleFormat = tree.ruleFormat;
  } else if (options.ruleTree) {
    const parsed = JSON.parse(options.ruleTree) as Record<string, unknown>;
    // Handle both { rules: {...} } envelope and bare rule
    rootRule = (parsed['rules'] ?? parsed) as PapiRule;
    ruleFormat = parsed['ruleFormat'] as string | undefined;
  } else {
    throw new Error('Either repoPath or ruleTree must be provided');
  }

  const rules: ParsedRule[] = [];
  let totalBehaviors = 0;

  flattenRule(rootRule, '', rules);
  for (const r of rules) {
    totalBehaviors += r.behaviors.length;
  }

  const variables = (rootRule.variables ?? []).map(v => ({
    name: v.name,
    value: v.value,
    description: v.description,
    sensitive: v.sensitive,
  }));

  return {
    rules,
    variables,
    ruleFormat,
    totalRules: rules.length,
    totalBehaviors,
  };
}

function flattenRule(
  rule: PapiRule,
  parentPath: string,
  result: ParsedRule[],
): void {
  const path = parentPath ? `${parentPath} > ${rule.name}` : rule.name;

  result.push({
    path,
    name: rule.name,
    behaviors: rule.behaviors.map(b => ({
      name: b.name,
      keyOptions: summarizeOptions(b.options),
    })),
    criteria: rule.criteria.map(c => ({
      name: c.name,
      matchType: (c.options['matchOperator'] as string) ?? 'IS',
      values: c.options['value'] ?? c.options['values'] ?? null,
    })),
    comments: rule.comments,
    childCount: rule.children.length,
  });

  for (const child of rule.children) {
    if (typeof child === 'object') {
      flattenRule(child as PapiRule, path, result);
    }
  }
}

function summarizeOptions(
  options: Record<string, unknown>,
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // For nested objects, just include key fields
      const nested = value as Record<string, unknown>;
      if ('id' in nested) summary[key] = { id: nested['id'] };
      else summary[key] = '[object]';
    } else {
      summary[key] = value;
    }
  }
  return summary;
}
