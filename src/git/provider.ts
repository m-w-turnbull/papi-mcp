import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getRemoteUrl, parseRemoteUrl } from './git-ops.js';

export interface MergeRequestParams {
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
}

export interface MergeRequestResult {
  url: string;
  id: number | string;
  provider: 'gitlab' | 'github';
}

export interface PipelineTriggerParams {
  branch: string;
  variables?: Record<string, string>;
}

export interface PipelineTriggerResult {
  url: string;
  id: number | string;
  provider: 'gitlab' | 'github';
}

export interface GitProvider {
  createMergeRequest(params: MergeRequestParams): Promise<MergeRequestResult>;
  triggerPipeline(params: PipelineTriggerParams): Promise<PipelineTriggerResult>;
}

export type ProviderType = 'gitlab' | 'github';

/** Shape of .papi-mcp.json relevant to git provider detection. */
interface ProjectConfig {
  gitProvider?: {
    type?: ProviderType;
    host?: string;
  };
}

export async function detectProvider(repoPath: string): Promise<{ type: ProviderType; host: string; owner: string; repo: string }> {
  // Check .papi-mcp.json config first
  const config = await loadGitProviderConfig(repoPath);
  if (config?.gitProvider?.type) {
    const remoteUrl = await getRemoteUrl(repoPath);
    const remote = parseRemoteUrl(remoteUrl);
    return {
      type: config.gitProvider.type,
      host: config.gitProvider.host ?? remote.host,
      owner: remote.owner,
      repo: remote.repo,
    };
  }

  // Auto-detect from remote URL
  const remoteUrl = await getRemoteUrl(repoPath);
  const remote = parseRemoteUrl(remoteUrl);

  if (remote.host.includes('gitlab')) {
    return { type: 'gitlab', ...remote };
  }
  if (remote.host.includes('github')) {
    return { type: 'github', ...remote };
  }

  throw new Error(
    `Cannot auto-detect git provider from host "${remote.host}". ` +
    `Configure .papi-mcp.json with:\n` +
    `{\n  "gitProvider": {\n    "type": "gitlab" | "github",\n    "host": "${remote.host}"\n  }\n}`
  );
}

export async function createProvider(repoPath: string): Promise<GitProvider> {
  const info = await detectProvider(repoPath);

  if (info.type === 'gitlab') {
    const { GitLabClient } = await import('./gitlab.js');
    return new GitLabClient(info.host, info.owner, info.repo);
  }

  const { GitHubClient } = await import('./github.js');
  return new GitHubClient(info.host, info.owner, info.repo);
}

async function loadGitProviderConfig(repoPath: string): Promise<ProjectConfig | undefined> {
  try {
    const configPath = resolve(repoPath, '.papi-mcp.json');
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content) as ProjectConfig;
  } catch {
    return undefined;
  }
}
