import { z } from 'zod';

// === Core PAPI Types ===

export interface PapiBehavior {
  name: string;
  options: Record<string, unknown>;
}

export interface PapiCriteria {
  name: string;
  options: Record<string, unknown>;
}

export interface PapiVariable {
  name: string;
  value: string;
  description: string;
  hidden: boolean;
  sensitive: boolean;
}

export interface PapiRule {
  name: string;
  children: (PapiRule | string)[]; // string for #include: directives
  behaviors: PapiBehavior[];
  criteria: PapiCriteria[];
  criteriaMustSatisfy: 'all' | 'any';
  comments?: string;
  options?: Record<string, unknown>;
  variables?: PapiVariable[];
}

export interface RuleTree {
  rules: PapiRule;
  ruleFormat?: string;
  comments?: string;
}

export interface LatestVersionInfo {
  propertyVersion: number;
  updatedByUser?: string;
  updatedDate?: string;
  productionStatus?: string;
  stagingStatus?: string;
  productId?: string;
  ruleFormat: string;
}

export interface EnvInfo {
  name: string;
  propertyId: string | number; // CLI uses numeric, but string "prp_12345" also valid
  propertyName: string;
  groupId: number;
  isSecure?: boolean;
  latestVersionInfo: LatestVersionInfo;
  suggestedRuleFormat?: string;
  lastSavedHash?: string;
  lastSavedHostnamesHash?: string;
  environmentHash?: string;
  lastKnownRuleTreeEtag?: string;
  pendingActivations?: {
    STAGING?: number;
    PRODUCTION?: number;
  };
  activeIn_STAGING_Info?: LatestVersionInfo;
  activeIn_PRODUCTION_Info?: LatestVersionInfo;
}

export interface ProjectInfo {
  name: string;
  productId: string;
  contractId: string;
  groupId: number;
  version: string; // CLI tool version
  isSecure: boolean;
  edgeGridConfig?: {
    section: string;
  };
}

export interface HostnameEntry {
  cnameFrom: string;
  cnameTo: string;
  cnameType: string;
  edgeHostnameId: string;
}

export interface PropertyConfig {
  envInfo: EnvInfo;
  projectInfo: ProjectInfo;
  hostnames: HostnameEntry[];
  snippets: Map<string, PapiRule>;
}

// === Validation Types ===

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationCheck {
  check: string;
  severity: ValidationSeverity;
  message: string;
  location?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationCheck[];
  warnings: ValidationCheck[];
  infos: ValidationCheck[];
}

// === Sync Types ===

export type SyncStatus = 'in-sync' | 'remote-ahead' | 'local-ahead' | 'content-modified';

export interface SyncResult {
  status: SyncStatus;
  localVersion: number;
  remoteVersion: number;
  localEtag?: string;
  remoteEtag?: string;
}

// === Diff Types ===

export interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  path: string;
  name: string;
  before?: unknown;
  after?: unknown;
}

export interface DiffResult {
  hasChanges: boolean;
  summary: {
    rulesAdded: number;
    rulesRemoved: number;
    rulesModified: number;
    behaviorsAdded: number;
    behaviorsRemoved: number;
    behaviorsModified: number;
    criteriaAdded: number;
    criteriaRemoved: number;
    criteriaModified: number;
    variablesAdded: number;
    variablesRemoved: number;
    variablesModified: number;
  };
  changes: DiffChange[];
  unifiedDiff: string;
}

// === Activation Types ===

export type ActivationNetwork = 'STAGING' | 'PRODUCTION';
export type ActivationStatus = 'PENDING' | 'ACTIVE' | 'FAILED' | 'DEACTIVATED' | 'ABORTED';

export interface ActivationRequest {
  propertyId: string;
  propertyVersion: number;
  network: ActivationNetwork;
  note?: string;
  notifyEmails?: string[];
  acknowledgeAllWarnings?: boolean;
}

export interface ActivationResponse {
  activationId: string;
  propertyId: string;
  propertyVersion: number;
  network: ActivationNetwork;
  status: ActivationStatus;
  note?: string;
  notifyEmails?: string[];
}

// === Redaction Types ===

export interface RedactionConfig {
  redact?: {
    sensitiveVariables?: boolean;
    fields?: string[];
    sensitiveHeaders?: string[];
  };
  gitProvider?: {
    type: 'gitlab' | 'github';
    host?: string;
  };
}

// === Auth Types ===

export interface EdgeGridCredentials {
  clientSecret: string;
  host: string;
  accessToken: string;
  clientToken: string;
}

// === Parsed Rule (LLM-friendly) ===

export interface ParsedRule {
  path: string;
  name: string;
  behaviors: { name: string; keyOptions: Record<string, unknown> }[];
  criteria: { name: string; matchType: string; values: unknown }[];
  comments?: string;
  childCount: number;
}

export interface ParsedRuleTree {
  rules: ParsedRule[];
  variables: { name: string; value: string; description: string; sensitive: boolean }[];
  ruleFormat?: string;
  totalRules: number;
  totalBehaviors: number;
}

// === PAPI API Response Types ===

export interface PapiError {
  type: string;
  title?: string;
  status: number;
  detail: string;
  retryAfter?: number;
}

export interface PapiRuleTreeResponse {
  propertyId: string;
  propertyVersion: number;
  etag: string;
  ruleFormat: string;
  rules: PapiRule;
}

export interface PapiValidationResponse {
  propertyId: string;
  propertyVersion: number;
  ruleFormat: string;
  errors: { type: string; errorLocation: string; detail: string }[];
  warnings: { type: string; errorLocation: string; detail: string }[];
}

export interface PapiVersionResponse {
  propertyVersion: number;
  etag: string;
  updatedDate: string;
  note?: string;
}

// === Zod Schemas for Tool Input Validation ===

export const GetPropertyConfigSchema = z.object({
  propertyId: z.string().optional().describe('Akamai property ID (e.g., prp_12345)'),
  version: z.number().optional().describe('Property version (defaults to latest)'),
  repoPath: z.string().optional().describe('Path to local property repo (auto-detects propertyId from envInfo.json)'),
  edgercPath: z.string().optional().describe('Custom .edgerc file path'),
  edgercSection: z.string().optional().describe('.edgerc section name (default: "default")'),
});

export const ReadSnippetsSchema = z.object({
  repoPath: z.string().describe('Path to the property repo'),
  snippetName: z.string().optional().describe('Specific snippet file name (omit to list all)'),
});

export const ParseRuleTreeSchema = z.object({
  repoPath: z.string().optional().describe('Path to the property repo (assembles from disk)'),
  ruleTree: z.string().optional().describe('Raw rule tree JSON string'),
}).refine(data => data.repoPath || data.ruleTree, {
  message: 'Either repoPath or ruleTree must be provided',
});

export const AssembleRuleTreeSchema = z.object({
  repoPath: z.string().describe('Path to the property repo'),
});

export const SyncPropertySchema = z.object({
  repoPath: z.string().describe('Path to the property repo'),
  dryRun: z.boolean().default(true).describe('If true, report status only (default)'),
  edgercPath: z.string().optional(),
  edgercSection: z.string().optional(),
});

export const ValidateConfigSchema = z.object({
  repoPath: z.string().describe('Path to the property repo'),
  apiValidation: z.boolean().default(false).describe('Also validate against PAPI API'),
  edgercPath: z.string().optional(),
  edgercSection: z.string().optional(),
});

export const DiffConfigsSchema = z.object({
  before: z.string().describe('First rule tree JSON string'),
  after: z.string().describe('Second rule tree JSON string'),
});

export const WriteSnippetSchema = z.object({
  repoPath: z.string().describe('Path to the property repo'),
  snippetName: z.string().describe('Snippet file name (e.g., "My_Rule.json")'),
  content: z.string().describe('Snippet content as JSON string'),
  addToMainJson: z.boolean().default(false).describe('Add #include: to main.json'),
  position: z.enum(['beginning', 'end']).default('end').describe('Position in children array'),
});

export const ApplyBehaviorSchema = z.object({
  repoPath: z.string().describe('Path to the property repo'),
  snippetName: z.string().describe('Target snippet file name'),
  behavior: z.string().describe('Behavior object as JSON string'),
  criteria: z.string().optional().describe('Criteria array as JSON string'),
  criteriaMustSatisfy: z.enum(['all', 'any']).optional(),
});

export const CreateBranchSchema = z.object({
  repoPath: z.string().describe('Path to the property repo'),
  type: z.enum(['feature', 'fix', 'refactor', 'chore']).describe('Branch type'),
  description: z.string().describe('Short description for branch name'),
});

export const CreateMergeRequestSchema = z.object({
  repoPath: z.string().describe('Path to the property repo'),
  title: z.string().describe('MR/PR title'),
  description: z.string().describe('Plain-English description of changes'),
  files: z.array(z.string()).optional().describe('Specific files to commit (defaults to all changed)'),
  targetBranch: z.string().default('main').describe('Target branch for MR/PR'),
});

export const ActivateStagingSchema = z.object({
  propertyId: z.string().optional(),
  version: z.number().optional(),
  repoPath: z.string().optional(),
  note: z.string().optional().describe('Activation note'),
  edgercPath: z.string().optional(),
  edgercSection: z.string().optional(),
}).refine(data => data.propertyId || data.repoPath, {
  message: 'Either propertyId or repoPath must be provided',
});

export const ActivateProductionSchema = z.object({
  propertyId: z.string().optional(),
  version: z.number().optional(),
  repoPath: z.string().optional(),
  acknowledgeProductionRisk: z.literal(true, {
    errorMap: () => ({ message: 'You must set acknowledgeProductionRisk to true for production activation' }),
  }),
  contactEmails: z.array(z.string().email()).min(1).describe('Required notification emails'),
  note: z.string().optional(),
  edgercPath: z.string().optional(),
  edgercSection: z.string().optional(),
}).refine(data => data.propertyId || data.repoPath, {
  message: 'Either propertyId or repoPath must be provided',
});

export const TriggerPipelineSchema = z.object({
  repoPath: z.string().describe('Path to the property repo'),
  branch: z.string().optional().describe('Branch to trigger pipeline for (defaults to current)'),
  variables: z.record(z.string()).optional().describe('Key-value variables for pipeline parameters'),
});
