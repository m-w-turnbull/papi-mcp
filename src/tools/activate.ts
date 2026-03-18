import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PapiClient } from '../papi/client.js';
import { resolveCredentials } from '../papi/auth.js';
import { findPmDirectory } from '../config/snippets.js';
import type { ActivationResponse, EnvInfo } from '../papi/types.js';

export interface ActivateStagingParams {
  propertyId?: string;
  version?: number;
  repoPath?: string;
  note?: string;
  edgercPath?: string;
  edgercSection?: string;
}

export interface ActivateProductionParams extends ActivateStagingParams {
  acknowledgeProductionRisk: boolean;
  contactEmails: string[];
}

export async function activateStaging(params: ActivateStagingParams): Promise<ActivationResponse> {
  const { propertyId, version } = await resolvePropertyInfo(params);
  const credentials = await resolveCredentials({
    edgercPath: params.edgercPath,
    section: params.edgercSection,
  });
  const client = new PapiClient(credentials);

  return client.activateProperty({
    propertyId,
    propertyVersion: version,
    network: 'STAGING',
    note: params.note ?? 'Staging activation via papi-mcp',
  });
}

export async function activateProduction(params: ActivateProductionParams): Promise<ActivationResponse> {
  // Hard gate: reject without risk acknowledgement
  if (params.acknowledgeProductionRisk !== true) {
    throw new Error(
      'Production activation requires acknowledgeProductionRisk: true. ' +
      'This confirms you understand the impact of activating to production.'
    );
  }

  const { propertyId, version } = await resolvePropertyInfo(params);
  const credentials = await resolveCredentials({
    edgercPath: params.edgercPath,
    section: params.edgercSection,
  });
  const client = new PapiClient(credentials);

  return client.activateProperty({
    propertyId,
    propertyVersion: version,
    network: 'PRODUCTION',
    note: params.note ?? 'Production activation via papi-mcp',
    notifyEmails: params.contactEmails,
  });
}

async function resolvePropertyInfo(params: { propertyId?: string; version?: number; repoPath?: string }): Promise<{ propertyId: string; version: number }> {
  let propertyId = params.propertyId;
  let version = params.version;

  if (!propertyId && params.repoPath) {
    const pmDir = await findPmDirectory(params.repoPath);
    const envInfoPath = resolve(pmDir, 'envInfo.json');
    const content = await readFile(envInfoPath, 'utf-8');
    const envInfo = JSON.parse(content) as EnvInfo;
    propertyId = String(envInfo.propertyId);
    version = version ?? envInfo.latestVersionInfo.propertyVersion;
  }

  if (!propertyId) {
    throw new Error('Either propertyId or repoPath must be provided');
  }
  if (!version) {
    throw new Error('Property version must be provided (either explicitly or via envInfo.json)');
  }

  return { propertyId, version };
}
