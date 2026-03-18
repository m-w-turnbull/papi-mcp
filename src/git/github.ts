import type { GitProvider, MergeRequestParams, MergeRequestResult, PipelineTriggerParams, PipelineTriggerResult } from './provider.js';

export class GitHubClient implements GitProvider {
  private readonly host: string;
  private readonly owner: string;
  private readonly repo: string;
  private readonly token: string;

  constructor(host: string, owner: string, repo: string) {
    this.host = host;
    this.owner = owner;
    this.repo = repo;
    this.token = this.resolveToken();
  }

  async createMergeRequest(params: MergeRequestParams): Promise<MergeRequestResult> {
    const apiBase = this.host === 'github.com' ? 'https://api.github.com' : `https://${this.host}/api/v3`;
    const url = `${apiBase}/repos/${this.owner}/${this.repo}/pulls`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({
        head: params.sourceBranch,
        base: params.targetBranch,
        title: params.title,
        body: params.description,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub PR creation failed (${response.status}): ${body}`);
    }

    const data = await response.json() as { number: number; html_url: string };
    return { url: data.html_url, id: data.number, provider: 'github' };
  }

  async triggerPipeline(params: PipelineTriggerParams): Promise<PipelineTriggerResult> {
    const apiBase = this.host === 'github.com' ? 'https://api.github.com' : `https://${this.host}/api/v3`;
    // List workflows to find the first one
    const listUrl = `${apiBase}/repos/${this.owner}/${this.repo}/actions/workflows`;

    const listResponse = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to list GitHub workflows (${listResponse.status})`);
    }

    const workflows = await listResponse.json() as { workflows: { id: number; name: string }[] };
    const workflow = workflows.workflows[0];
    if (!workflow) {
      throw new Error('No GitHub Actions workflows found in repository');
    }

    const dispatchUrl = `${apiBase}/repos/${this.owner}/${this.repo}/actions/workflows/${workflow.id}/dispatches`;

    const response = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({
        ref: params.branch,
        inputs: params.variables ?? {},
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub workflow dispatch failed (${response.status}): ${body}`);
    }

    // GitHub dispatch returns 204 No Content on success, no body
    const workflowUrl = `https://${this.host}/${this.owner}/${this.repo}/actions`;
    return { url: workflowUrl, id: workflow.id, provider: 'github' };
  }

  private resolveToken(): string {
    const token = process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'];

    if (!token) {
      throw new Error('GitHub token not found. Set one of: GITHUB_TOKEN, GH_TOKEN');
    }
    return token;
  }
}
