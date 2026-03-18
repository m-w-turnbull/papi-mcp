import type { ValidationResult, ValidationCheck } from '../papi/types.js';
import { PapiClient, PapiClientError } from '../papi/client.js';
import { resolveCredentials } from '../papi/auth.js';
import { assembleRuleTree } from '../config/assembler.js';
import { readMetadata } from '../config/snippets.js';
import { validateLocal } from './local.js';

export async function validateWithApi(
  repoPath: string,
  options?: { edgercPath?: string; edgercSection?: string }
): Promise<ValidationResult> {
  // Always run local validation first
  const localResult = await validateLocal(repoPath);

  // Try API validation
  let apiChecks: ValidationCheck[] = [];
  try {
    const credentials = await resolveCredentials({
      edgercPath: options?.edgercPath,
      section: options?.edgercSection,
    });
    const client = new PapiClient(credentials);
    const metadata = await readMetadata(repoPath);
    const tree = await assembleRuleTree(repoPath);

    const apiResult = await client.validateRuleTree(
      String(metadata.envInfo.propertyId),
      metadata.envInfo.latestVersionInfo.propertyVersion,
      tree.rules,
    );

    // Convert API errors to ValidationCheck format
    for (const err of apiResult.errors) {
      apiChecks.push({
        check: 'papi-api',
        severity: 'error',
        message: err.detail,
        location: err.errorLocation,
      });
    }
    for (const warn of apiResult.warnings) {
      apiChecks.push({
        check: 'papi-api',
        severity: 'warning',
        message: warn.detail,
        location: warn.errorLocation,
      });
    }
  } catch (error) {
    // API unavailable — return local results with a note
    const message = error instanceof PapiClientError
      ? `PAPI API validation unavailable: ${error.message} (status: ${error.statusCode})`
      : `PAPI API validation unavailable: ${(error as Error).message}`;

    apiChecks.push({
      check: 'papi-api',
      severity: 'info',
      message,
      location: 'api',
    });
  }

  // Merge local + API results
  const allChecks = [...localResult.errors, ...localResult.warnings, ...localResult.infos, ...apiChecks];
  return {
    valid: allChecks.filter(c => c.severity === 'error').length === 0,
    errors: allChecks.filter(c => c.severity === 'error'),
    warnings: allChecks.filter(c => c.severity === 'warning'),
    infos: allChecks.filter(c => c.severity === 'info'),
  };
}
