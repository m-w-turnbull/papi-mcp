import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class GitError extends Error {
  constructor(message: string, public readonly exitCode?: number) {
    super(message);
    this.name = 'GitError';
  }
}

export interface RemoteInfo {
  host: string;
  owner: string;
  repo: string;
}

export async function createBranch(repoPath: string, branchName: string): Promise<void> {
  await git(repoPath, ['checkout', '-b', branchName]);
}

export async function commitAndPush(repoPath: string, message: string, files?: string[]): Promise<void> {
  if (files && files.length > 0) {
    await git(repoPath, ['add', ...files]);
  } else {
    await git(repoPath, ['add', '-A']);
  }
  await git(repoPath, ['commit', '-m', message]);
  const branch = await getCurrentBranch(repoPath);
  await git(repoPath, ['push', '-u', 'origin', branch]);
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  const { stdout } = await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return stdout.trim();
}

export async function getRemoteUrl(repoPath: string): Promise<string> {
  const { stdout } = await git(repoPath, ['remote', 'get-url', 'origin']);
  return stdout.trim();
}

export function parseRemoteUrl(url: string): RemoteInfo {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return { host: sshMatch[1]!, owner: sshMatch[2]!, repo: sshMatch[3]! };
  }

  // HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = url.match(/^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { host: httpsMatch[1]!, owner: httpsMatch[2]!, repo: httpsMatch[3]! };
  }

  throw new GitError(`Cannot parse remote URL: ${url}. Expected SSH (git@host:owner/repo) or HTTPS format.`);
}

export function buildBranchName(type: string, description: string): string {
  const sanitized = description
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `akamai/${type}/${sanitized}`;
}

async function git(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync('git', args, { cwd });
  } catch (error: unknown) {
    const err = error as { stderr?: string; code?: number };
    throw new GitError(
      `git ${args[0]} failed: ${err.stderr ?? 'Unknown error'}`,
      err.code,
    );
  }
}
