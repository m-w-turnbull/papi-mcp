import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PapiClient } from '../papi/client.js';
import { resolveCredentials } from '../papi/auth.js';
import type { EnvInfo } from '../papi/types.js';
import { findPmDirectory } from '../config/snippets.js';

export interface GetPropertyConfigParams {
  propertyId?: string;
  version?: number;
  repoPath?: string;
  edgercPath?: string;
  edgercSection?: string;
}

export async function getPropertyConfig(params: GetPropertyConfigParams): Promise<string> {
  const { version, edgercPath, edgercSection } = params;
  let { propertyId } = params;

  // Auto-detect propertyId from envInfo.json if repoPath provided
  if (!propertyId && params.repoPath) {
    propertyId = await detectPropertyId(params.repoPath);
  }

  if (!propertyId) {
    throw new Error('Either propertyId or repoPath must be provided to identify the property');
  }

  const credentials = await resolveCredentials({ edgercPath, section: edgercSection });
  const client = new PapiClient(credentials);
  const ruleTree = await client.getRuleTree(propertyId, version);

  // Best-effort: store the etag for future sync comparisons
  if (params.repoPath && ruleTree.etag) {
    try {
      const pmDir = await findPmDirectory(params.repoPath);
      const envInfoPath = resolve(pmDir, 'envInfo.json');
      const envContent = await readFile(envInfoPath, 'utf-8');
      const envInfo = JSON.parse(envContent) as EnvInfo;
      envInfo.lastKnownRuleTreeEtag = ruleTree.etag;
      await writeFile(envInfoPath, JSON.stringify(envInfo, null, 2) + '\n', 'utf-8');
    } catch {
      // Don't fail the tool call if writing the etag fails
    }
  }

  return JSON.stringify(ruleTree, null, 2);
}

async function detectPropertyId(repoPath: string): Promise<string> {
  const pmDir = await findPmDirectory(repoPath);
  const envInfoPath = resolve(pmDir, 'envInfo.json');

  try {
    const content = await readFile(envInfoPath, 'utf-8');
    const envInfo = JSON.parse(content) as EnvInfo;
    if (!envInfo.propertyId) {
      throw new Error('propertyId field not found in envInfo.json');
    }
    return String(envInfo.propertyId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`envInfo.json not found at ${envInfoPath}`);
    }
    throw error;
  }
}
