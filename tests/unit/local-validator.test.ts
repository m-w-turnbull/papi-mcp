import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { validateLocal } from '../../src/validation/local.js';

const VALID_FIXTURE = resolve(import.meta.dirname, '../fixtures/sample-property');

describe('local validator', () => {
  it('passes on valid config', async () => {
    const result = await validateLocal(VALID_FIXTURE);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('reports variable references', async () => {
    const result = await validateLocal(VALID_FIXTURE);
    // All variables in fixture are declared, so no warnings for variable references
    const varWarnings = result.warnings.filter(w => w.check === 'variable-references');
    expect(varWarnings.length).toBe(0);
  });

  it('reports no orphans for valid fixture', async () => {
    const result = await validateLocal(VALID_FIXTURE);
    // All snippets in fixture are referenced
    const orphanWarnings = result.warnings.filter(w => w.check === 'orphan-detection');
    expect(orphanWarnings.length).toBe(0);
  });

  it('categorizes checks by severity', async () => {
    const result = await validateLocal(VALID_FIXTURE);
    // Valid config should have zero errors
    expect(result.errors.every(c => c.severity === 'error')).toBe(true);
    expect(result.warnings.every(c => c.severity === 'warning')).toBe(true);
    expect(result.infos.every(c => c.severity === 'info')).toBe(true);
  });
});
