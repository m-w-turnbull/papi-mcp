import { createProvider } from '../git/provider.js';
import { getCurrentBranch } from '../git/git-ops.js';

export interface TriggerPipelineParams {
  repoPath: string;
  branch?: string;
  variables?: Record<string, string>;
}

export async function triggerPipeline(params: TriggerPipelineParams): Promise<{
  url: string;
  id: number | string;
  provider: string;
}> {
  const { repoPath, variables } = params;
  const branch = params.branch ?? await getCurrentBranch(repoPath);
  const provider = await createProvider(repoPath);

  return provider.triggerPipeline({ branch, variables });
}
