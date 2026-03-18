import type { DiffChange, DiffResult, PapiRule, PapiBehavior, PapiCriteria, PapiVariable } from '../papi/types.js';

export function diffConfigs(beforeJson: string, afterJson: string): DiffResult {
  const before = JSON.parse(beforeJson) as { rules: PapiRule };
  const after = JSON.parse(afterJson) as { rules: PapiRule };

  const changes: DiffChange[] = [];

  // Diff rules
  diffRules(before.rules, after.rules, '', changes);

  // Diff variables
  diffVariables(before.rules.variables ?? [], after.rules.variables ?? [], changes);

  const summary = {
    rulesAdded: 0, rulesRemoved: 0, rulesModified: 0,
    behaviorsAdded: 0, behaviorsRemoved: 0, behaviorsModified: 0,
    criteriaAdded: 0, criteriaRemoved: 0, criteriaModified: 0,
    variablesAdded: 0, variablesRemoved: 0, variablesModified: 0,
  };

  for (const c of changes) {
    const prefix = c.path.split('.')[0] ?? '';
    if (prefix === 'rule' || prefix === 'rules') {
      summary[`rules${capitalize(c.type)}` as keyof typeof summary]++;
    } else if (prefix === 'behavior') {
      summary[`behaviors${capitalize(c.type)}` as keyof typeof summary]++;
    } else if (prefix === 'criteria') {
      summary[`criteria${capitalize(c.type)}` as keyof typeof summary]++;
    } else if (prefix === 'variable') {
      summary[`variables${capitalize(c.type)}` as keyof typeof summary]++;
    }
  }

  // Generate unified diff
  const unifiedDiff = generateUnifiedDiff(beforeJson, afterJson);

  return {
    hasChanges: changes.length > 0,
    summary,
    changes,
    unifiedDiff,
  };
}

function diffRules(before: PapiRule, after: PapiRule, path: string, changes: DiffChange[]): void {
  const currentPath = path ? `${path} > ${before.name}` : before.name;

  // Diff behaviors
  diffBehaviors(before.behaviors, after.behaviors, currentPath, changes);

  // Diff criteria
  diffCriteria(before.criteria, after.criteria, currentPath, changes);

  // Diff child rules
  const beforeChildren = (before.children ?? []).filter(c => typeof c === 'object') as PapiRule[];
  const afterChildren = (after.children ?? []).filter(c => typeof c === 'object') as PapiRule[];

  const beforeMap = new Map(beforeChildren.map(c => [c.name, c]));
  const afterMap = new Map(afterChildren.map(c => [c.name, c]));

  for (const [name, rule] of afterMap) {
    if (!beforeMap.has(name)) {
      changes.push({ type: 'added', path: `rule.${currentPath}`, name, after: rule });
    } else {
      diffRules(beforeMap.get(name)!, rule, currentPath, changes);
    }
  }

  for (const [name, rule] of beforeMap) {
    if (!afterMap.has(name)) {
      changes.push({ type: 'removed', path: `rule.${currentPath}`, name, before: rule });
    }
  }
}

function diffBehaviors(before: PapiBehavior[], after: PapiBehavior[], rulePath: string, changes: DiffChange[]): void {
  const beforeMap = new Map(before.map(b => [b.name, b]));
  const afterMap = new Map(after.map(b => [b.name, b]));

  for (const [name, behavior] of afterMap) {
    if (!beforeMap.has(name)) {
      changes.push({ type: 'added', path: `behavior.${rulePath}`, name, after: behavior });
    } else {
      const beforeBehavior = beforeMap.get(name)!;
      if (JSON.stringify(beforeBehavior.options) !== JSON.stringify(behavior.options)) {
        changes.push({
          type: 'modified', path: `behavior.${rulePath}`, name,
          before: beforeBehavior, after: behavior,
        });
      }
    }
  }

  for (const name of beforeMap.keys()) {
    if (!afterMap.has(name)) {
      changes.push({ type: 'removed', path: `behavior.${rulePath}`, name, before: beforeMap.get(name) });
    }
  }
}

function diffCriteria(before: PapiCriteria[], after: PapiCriteria[], rulePath: string, changes: DiffChange[]): void {
  const beforeMap = new Map(before.map(c => [c.name, c]));
  const afterMap = new Map(after.map(c => [c.name, c]));

  for (const [name, criteria] of afterMap) {
    if (!beforeMap.has(name)) {
      changes.push({ type: 'added', path: `criteria.${rulePath}`, name, after: criteria });
    } else {
      const beforeCriteria = beforeMap.get(name)!;
      if (JSON.stringify(beforeCriteria.options) !== JSON.stringify(criteria.options)) {
        changes.push({
          type: 'modified', path: `criteria.${rulePath}`, name,
          before: beforeCriteria, after: criteria,
        });
      }
    }
  }

  for (const name of beforeMap.keys()) {
    if (!afterMap.has(name)) {
      changes.push({ type: 'removed', path: `criteria.${rulePath}`, name, before: beforeMap.get(name) });
    }
  }
}

function diffVariables(before: PapiVariable[], after: PapiVariable[], changes: DiffChange[]): void {
  const beforeMap = new Map(before.map(v => [v.name, v]));
  const afterMap = new Map(after.map(v => [v.name, v]));

  for (const [name, variable] of afterMap) {
    if (!beforeMap.has(name)) {
      changes.push({ type: 'added', path: 'variable', name, after: variable });
    } else {
      if (JSON.stringify(beforeMap.get(name)) !== JSON.stringify(variable)) {
        changes.push({ type: 'modified', path: 'variable', name, before: beforeMap.get(name), after: variable });
      }
    }
  }

  for (const name of beforeMap.keys()) {
    if (!afterMap.has(name)) {
      changes.push({ type: 'removed', path: 'variable', name, before: beforeMap.get(name) });
    }
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1) as 'Added' | 'Removed' | 'Modified';
}

function generateUnifiedDiff(beforeJson: string, afterJson: string): string {
  const beforeLines = JSON.stringify(JSON.parse(beforeJson), null, 2).split('\n');
  const afterLines = JSON.stringify(JSON.parse(afterJson), null, 2).split('\n');

  const diff: string[] = ['--- before', '+++ after'];
  const maxLen = Math.max(beforeLines.length, afterLines.length);

  for (let i = 0; i < maxLen; i++) {
    const bLine = beforeLines[i];
    const aLine = afterLines[i];
    if (bLine === aLine) {
      diff.push(` ${bLine}`);
    } else {
      if (bLine !== undefined) diff.push(`-${bLine}`);
      if (aLine !== undefined) diff.push(`+${aLine}`);
    }
  }

  return diff.join('\n');
}
