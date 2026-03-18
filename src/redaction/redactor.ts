import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import type { RedactionConfig } from '../papi/types.js';

export class Redactor {
  private readonly config: RedactionConfig['redact'];

  constructor(config?: RedactionConfig) {
    this.config = config?.redact;
  }

  /**
   * Apply redaction rules to an object. Returns a deep clone with sensitive fields replaced.
   * If no redaction config, returns the original object unchanged.
   */
  redact<T>(data: T): T {
    if (!this.config) return data;
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;

    return this.redactValue(structuredClone(data), []) as T;
  }

  private redactValue(value: unknown, path: string[]): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;

    if (Array.isArray(value)) {
      return value.map((item, i) => this.redactValue(item, [...path, String(i)]));
    }

    const obj = value as Record<string, unknown>;

    for (const key of Object.keys(obj)) {
      const currentPath = [...path, key];

      // Check sensitiveHeaders — context-aware: if this is options.headerName matching a sensitive header,
      // redact the sibling options.headerValue
      if (key === 'headerValue' && this.config?.sensitiveHeaders) {
        const headerName = obj['headerName'];
        if (typeof headerName === 'string') {
          const isSensitive = this.config.sensitiveHeaders.some(
            h => h.toLowerCase() === headerName.toLowerCase()
          );
          if (isSensitive) {
            obj[key] = '[REDACTED]';
            continue;
          }
        }
      }

      // Check sensitiveVariables — redact value field of sensitive variables
      if (this.config?.sensitiveVariables && key === 'value') {
        const sensitive = obj['sensitive'];
        if (sensitive === true) {
          obj[key] = '[REDACTED]';
          continue;
        }
      }

      // Check field patterns
      if (this.config?.fields && typeof obj[key] !== 'object') {
        const pathStr = currentPath.join('.');
        const shouldRedact = this.config.fields.some(pattern => this.matchPattern(pathStr, pattern));
        if (shouldRedact) {
          obj[key] = '[REDACTED]';
          continue;
        }
      }

      // Recurse into nested objects
      obj[key] = this.redactValue(obj[key], currentPath);
    }

    return obj;
  }

  /**
   * Pattern matching: dot-delimited suffix matching.
   * `*` matches a single path segment.
   * e.g., pattern "options.hostname" matches "rules.children.0.behaviors.0.options.hostname"
   * e.g., pattern "variables.*.value" matches "variables.0.value" or "variables.MY_VAR.value"
   */
  private matchPattern(fullPath: string, pattern: string): boolean {
    const pathParts = fullPath.split('.');
    const patternParts = pattern.split('.');

    // Suffix matching — try matching pattern against end of path
    if (pathParts.length < patternParts.length) return false;

    const startIdx = pathParts.length - patternParts.length;
    for (let i = 0; i < patternParts.length; i++) {
      const pathPart = pathParts[startIdx + i]!;
      const patternPart = patternParts[i]!;
      if (patternPart !== '*' && patternPart !== pathPart) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Load RedactionConfig from .papi-mcp.json.
 * Search order: env var path > working dir > home dir.
 * Returns undefined if no config found (not an error).
 */
export async function loadRedactionConfig(): Promise<RedactionConfig | undefined> {
  const envPath = process.env['PAPI_MCP_CONFIG_PATH'];

  // Check env var overrides first (individual fields)
  const envFields = process.env['PAPI_MCP_REDACT_FIELDS'];
  const envHeaders = process.env['PAPI_MCP_REDACT_SENSITIVE_HEADERS'];
  const envSensitiveVars = process.env['PAPI_MCP_REDACT_SENSITIVE_VARS'];

  if (envFields || envHeaders || envSensitiveVars) {
    return {
      redact: {
        fields: envFields ? envFields.split(',').map(f => f.trim()) : undefined,
        sensitiveHeaders: envHeaders ? envHeaders.split(',').map(h => h.trim()) : undefined,
        sensitiveVariables: envSensitiveVars === 'true',
      },
    };
  }

  // Try config file
  const searchPaths = envPath
    ? [envPath]
    : [
        resolve(process.cwd(), '.papi-mcp.json'),
        resolve(homedir(), '.papi-mcp.json'),
      ];

  for (const configPath of searchPaths) {
    try {
      const content = await readFile(configPath, 'utf-8');
      return JSON.parse(content) as RedactionConfig;
    } catch {
      // File not found, try next
    }
  }

  return undefined;
}
