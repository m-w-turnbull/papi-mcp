import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PapiRule, EnvInfo, ProjectInfo, HostnameEntry } from '../papi/types.js';

export async function findPmDirectory(repoPath: string): Promise<string> {
  const entries = await readdir(repoPath, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());

  // Primary: find a directory containing a config-snippets/ subdirectory
  for (const dir of dirs) {
    const candidate = resolve(repoPath, dir.name, 'config-snippets');
    try {
      await access(candidate);
      return resolve(repoPath, dir.name);
    } catch {
      // no config-snippets here, continue
    }
  }

  throw new Error(
    `No Akamai property directory found in ${repoPath}. ` +
    `Expected a directory containing config-snippets/ (Akamai CLI layout).`
  );
}

export async function listSnippets(repoPath: string): Promise<string[]> {
  const pmDir = await findPmDirectory(repoPath);
  const snippetsDir = resolve(pmDir, 'config-snippets');
  const entries = await readdir(snippetsDir);
  return entries.filter(f => f.endsWith('.json'));
}

export async function readSnippet(repoPath: string, snippetName: string): Promise<PapiRule> {
  const pmDir = await findPmDirectory(repoPath);
  const filePath = resolve(pmDir, 'config-snippets', snippetName);
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as PapiRule;
}

export async function readAllSnippets(repoPath: string): Promise<Map<string, PapiRule>> {
  const names = await listSnippets(repoPath);
  const pmDir = await findPmDirectory(repoPath);
  const snippetsDir = resolve(pmDir, 'config-snippets');
  const result = new Map<string, PapiRule>();

  for (const name of names) {
    const content = await readFile(resolve(snippetsDir, name), 'utf-8');
    result.set(name, JSON.parse(content) as PapiRule);
  }

  return result;
}

export async function writeSnippet(
  repoPath: string,
  snippetName: string,
  content: PapiRule,
): Promise<void> {
  const requiredFields: (keyof PapiRule)[] = [
    'name',
    'children',
    'behaviors',
    'criteria',
    'criteriaMustSatisfy',
  ];

  for (const field of requiredFields) {
    if (!(field in content)) {
      throw new Error(`Missing required PapiRule field: ${field}`);
    }
  }

  const pmDir = await findPmDirectory(repoPath);
  const snippetsDir = resolve(pmDir, 'config-snippets');
  await mkdir(snippetsDir, { recursive: true });
  const filePath = resolve(snippetsDir, snippetName);
  await writeFile(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
}

export async function readMetadata(repoPath: string): Promise<{
  envInfo: EnvInfo;
  projectInfo: ProjectInfo;
  hostnames: HostnameEntry[];
}> {
  const pmDir = await findPmDirectory(repoPath);

  const [envRaw, projRaw, hostRaw] = await Promise.all([
    readFile(resolve(pmDir, 'envInfo.json'), 'utf-8'),
    readFile(resolve(pmDir, 'projectInfo.json'), 'utf-8'),
    readFile(resolve(pmDir, 'hostnames.json'), 'utf-8'),
  ]);

  return {
    envInfo: JSON.parse(envRaw) as EnvInfo,
    projectInfo: JSON.parse(projRaw) as ProjectInfo,
    hostnames: JSON.parse(hostRaw) as HostnameEntry[],
  };
}
