import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PapiClient } from '../papi/client.js';
import { resolveCredentials } from '../papi/auth.js';
import { findPmDirectory } from '../config/snippets.js';
import type { EnvInfo, SyncResult, SyncStatus } from '../papi/types.js';

export interface SyncPropertyParams {
  repoPath: string;
  dryRun?: boolean;
  edgercPath?: string;
  edgercSection?: string;
}

export async function syncProperty(params: SyncPropertyParams): Promise<SyncResult> {
  const { repoPath, edgercPath, edgercSection } = params;

  // Read local envInfo
  const pmDir = await findPmDirectory(repoPath);
  const envInfoPath = resolve(pmDir, 'envInfo.json');

  let envInfo: EnvInfo;
  try {
    const content = await readFile(envInfoPath, 'utf-8');
    envInfo = JSON.parse(content) as EnvInfo;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`envInfo.json not found at ${envInfoPath}`);
    }
    throw error;
  }

  // Fetch remote version info
  const credentials = await resolveCredentials({ edgercPath, section: edgercSection });
  const client = new PapiClient(credentials);
  const propertyId = String(envInfo.propertyId);
  const versions = await client.getPropertyVersions(propertyId);

  if (versions.length === 0) {
    throw new Error(`No versions found for property ${propertyId}`);
  }

  // Get latest remote version
  const sorted = [...versions].sort((a, b) => b.propertyVersion - a.propertyVersion);
  const latestRemote = sorted[0]!;

  // Determine sync status by version number comparison
  const localVersion = envInfo.latestVersionInfo.propertyVersion;
  let status: SyncStatus;
  let localEtag: string | undefined;
  let remoteEtag: string | undefined;

  if (localVersion === latestRemote.propertyVersion) {
    // Same version — check for content drift via etag comparison
    localEtag = envInfo.lastKnownRuleTreeEtag;
    if (localEtag) {
      const remoteRuleTree = await client.getRuleTree(propertyId, latestRemote.propertyVersion);
      remoteEtag = remoteRuleTree.etag;
      status = localEtag === remoteEtag ? 'in-sync' : 'content-modified';
    } else {
      // No local etag stored — can't compare, assume OK
      status = 'in-sync';
    }
  } else if (localVersion < latestRemote.propertyVersion) {
    status = 'remote-ahead';
  } else {
    status = 'local-ahead';
  }

  return {
    status,
    localVersion,
    remoteVersion: latestRemote.propertyVersion,
    localEtag,
    remoteEtag,
  };
}
