import { describe, it, expect } from 'vitest';
import { Redactor, loadRedactionConfig } from '../../src/redaction/redactor.js';
import type { RedactionConfig } from '../../src/papi/types.js';

describe('Redactor', () => {
  it('returns data unchanged when no config', () => {
    const redactor = new Redactor();
    const data = { name: 'test', options: { hostname: 'secret.com' } };
    expect(redactor.redact(data)).toEqual(data);
  });

  it('returns data unchanged when empty config', () => {
    const redactor = new Redactor({});
    const data = { name: 'test', value: 'keep' };
    expect(redactor.redact(data)).toEqual(data);
  });

  it('redacts fields matching pattern', () => {
    const config: RedactionConfig = {
      redact: {
        fields: ['options.hostname'],
      },
    };
    const redactor = new Redactor(config);
    const data = {
      rules: {
        behaviors: [
          { name: 'origin', options: { hostname: 'secret.example.com', port: 443 } },
        ],
      },
    };
    const result = redactor.redact(data);
    expect(result.rules.behaviors[0].options.hostname).toBe('[REDACTED]');
    expect(result.rules.behaviors[0].options.port).toBe(443);
  });

  it('handles wildcard patterns', () => {
    const config: RedactionConfig = {
      redact: {
        fields: ['variables.*.value'],
      },
    };
    const redactor = new Redactor(config);
    const data = {
      variables: {
        API_KEY: { value: 'secret123', name: 'API_KEY' },
        HOST: { value: 'example.com', name: 'HOST' },
      },
    };
    const result = redactor.redact(data);
    expect(result.variables.API_KEY.value).toBe('[REDACTED]');
    expect(result.variables.HOST.value).toBe('[REDACTED]');
    expect(result.variables.API_KEY.name).toBe('API_KEY');
  });

  it('redacts sensitive variables when sensitiveVariables is true', () => {
    const config: RedactionConfig = {
      redact: {
        sensitiveVariables: true,
      },
    };
    const redactor = new Redactor(config);
    const data = {
      variables: [
        { name: 'PMUSER_HOST', value: 'example.com', sensitive: false },
        { name: 'PMUSER_KEY', value: 'secret', sensitive: true },
      ],
    };
    const result = redactor.redact(data);
    expect(result.variables[0].value).toBe('example.com');
    expect(result.variables[1].value).toBe('[REDACTED]');
  });

  it('redacts sensitive headers by context', () => {
    const config: RedactionConfig = {
      redact: {
        sensitiveHeaders: ['authorization', 'x-api-key'],
      },
    };
    const redactor = new Redactor(config);
    const data = {
      behaviors: [
        {
          name: 'modifyOutgoingRequestHeader',
          options: { headerName: 'Authorization', headerValue: 'Bearer token123' },
        },
        {
          name: 'modifyOutgoingRequestHeader',
          options: { headerName: 'Content-Type', headerValue: 'application/json' },
        },
        {
          name: 'modifyOutgoingRequestHeader',
          options: { headerName: 'X-API-Key', headerValue: 'key-456' },
        },
      ],
    };
    const result = redactor.redact(data);
    expect(result.behaviors[0].options.headerValue).toBe('[REDACTED]');
    expect(result.behaviors[1].options.headerValue).toBe('application/json');
    expect(result.behaviors[2].options.headerValue).toBe('[REDACTED]');
  });

  it('does not mutate original data', () => {
    const config: RedactionConfig = {
      redact: { fields: ['options.hostname'] },
    };
    const redactor = new Redactor(config);
    const data = { options: { hostname: 'secret.com' } };
    const result = redactor.redact(data);
    expect(data.options.hostname).toBe('secret.com');
    expect(result.options.hostname).toBe('[REDACTED]');
  });

  it('handles null and undefined gracefully', () => {
    const redactor = new Redactor({ redact: { fields: ['a.b'] } });
    expect(redactor.redact(null)).toBeNull();
    expect(redactor.redact(undefined)).toBeUndefined();
    expect(redactor.redact('string')).toBe('string');
    expect(redactor.redact(42)).toBe(42);
  });

  it('handles nested arrays', () => {
    const config: RedactionConfig = {
      redact: { fields: ['options.hostname'] },
    };
    const redactor = new Redactor(config);
    const data = {
      rules: [
        { behaviors: [{ options: { hostname: 'h1.com' } }] },
        { behaviors: [{ options: { hostname: 'h2.com', port: 80 } }] },
      ],
    };
    const result = redactor.redact(data);
    expect(result.rules[0].behaviors[0].options.hostname).toBe('[REDACTED]');
    expect(result.rules[1].behaviors[0].options.hostname).toBe('[REDACTED]');
    expect(result.rules[1].behaviors[0].options.port).toBe(80);
  });
});
