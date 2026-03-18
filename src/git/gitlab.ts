import type { GitProvider, MergeRequestParams, MergeRequestResult, PipelineTriggerParams, PipelineTriggerResult } from './provider.js';

export class GitLabClient implements GitProvider {
  private readonly host: string;
  private readonly projectPath: string;
  private readonly token: string;

  constructor(host: string, owner: string, repo: string) {
    this.host = host;
    this.projectPath = encodeURIComponent(`${owner}/${repo}`);
    this.token = this.resolveToken();
  }

  async createMergeRequest(params: MergeRequestParams): Promise<MergeRequestResult> {
    const url = `https://${this.host}/api/v4/projects/${this.projectPath}/merge_requests`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PRIVATE-TOKEN': this.token,
      },
      body: JSON.stringify({
        source_branch: params.sourceBranch,
        target_branch: params.targetBranch,
        title: params.title,
        description: params.description,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitLab MR creation failed (${response.status}): ${body}`);
    }

    const data = await response.json() as { iid: number; web_url: string };
    return { url: data.web_url, id: data.iid, provider: 'gitlab' };
  }

  async triggerPipeline(params: PipelineTriggerParams): Promise<PipelineTriggerResult> {
    const url = `https://${this.host}/api/v4/projects/${this.projectPath}/pipeline`;
    const variables = params.variables
      ? Object.entries(params.variables).map(([key, value]) => ({ key, value, variable_type: 'env_var' }))
      : [];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PRIVATE-TOKEN': this.token,
      },
      body: JSON.stringify({
        ref: params.branch,
        variables,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitLab pipeline trigger failed (${response.status}): ${body}`);
    }

    const data = await response.json() as { id: number; web_url: string };
    return { url: data.web_url, id: data.id, provider: 'gitlab' };
  }

  private resolveToken(): string {
    const token = process.env['GITLAB_TOKEN']
      ?? process.env['GITLAB_PERSONAL_ACCESS_TOKEN']
      ?? process.env['CI_JOB_TOKEN'];

    if (!token) {
      throw new Error(
        'GitLab token not found. Set one of: GITLAB_TOKEN, GITLAB_PERSONAL_ACCESS_TOKEN, CI_JOB_TOKEN'
      );
    }
    return token;
  }
}
