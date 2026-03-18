import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncProperty } from '../../src/tools/sync-property.js';

// Mock auth and client
vi.mock('../../src/papi/auth.js', () => ({
  resolveCredentials: vi.fn().mockResolvedValue({
    clientSecret: 'test', host: 'test.luna.akamaiapis.net',
    accessToken: 'test', clientToken: 'test',
  }),
}));

const mockGetPropertyVersions = vi.fn();
const mockGetRuleTree = vi.fn();
vi.mock('../../src/papi/client.js', () => ({
  PapiClient: vi.fn().mockImplementation(() => ({
    getPropertyVersions: mockGetPropertyVersions,
    getRuleTree: mockGetRuleTree,
  })),
  PapiClientError: class extends Error { statusCode: number; constructor(m: string, s: number) { super(m); this.statusCode = s; } },
}));

const FIXTURE_PATH = new URL('../fixtures/sample-property', import.meta.url).pathname;
const FIXTURE_PATH_WITH_ETAG = new URL('../fixtures/sample-property-with-etag', import.meta.url).pathname;

describe('syncProperty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects in-sync when versions match', async () => {
    mockGetPropertyVersions.mockResolvedValue([
      { propertyVersion: 5, updatedDate: '2024-01-01' },
    ]);
    const result = await syncProperty({ repoPath: FIXTURE_PATH });
    expect(result.status).toBe('in-sync');
    expect(result.localVersion).toBe(5);
    expect(result.remoteVersion).toBe(5);
  });

  it('detects remote-ahead when remote version higher', async () => {
    mockGetPropertyVersions.mockResolvedValue([
      { propertyVersion: 5, updatedDate: '2024-01-01' },
      { propertyVersion: 6, updatedDate: '2024-01-02' },
    ]);
    const result = await syncProperty({ repoPath: FIXTURE_PATH });
    expect(result.status).toBe('remote-ahead');
    expect(result.remoteVersion).toBe(6);
  });

  it('detects local-ahead when local version higher', async () => {
    mockGetPropertyVersions.mockResolvedValue([
      { propertyVersion: 3, updatedDate: '2024-01-01' },
    ]);
    const result = await syncProperty({ repoPath: FIXTURE_PATH });
    expect(result.status).toBe('local-ahead');
    expect(result.localVersion).toBe(5);
    expect(result.remoteVersion).toBe(3);
  });

  it('detects content-modified when versions match but etags differ', async () => {
    mockGetPropertyVersions.mockResolvedValue([
      { propertyVersion: 5, updatedDate: '2024-01-01' },
    ]);
    mockGetRuleTree.mockResolvedValue({
      propertyId: '12345',
      propertyVersion: 5,
      etag: 'remote-etag-xyz',
      ruleFormat: 'v2024-02-12',
      rules: { name: 'default', children: [], behaviors: [], criteria: [], criteriaMustSatisfy: 'all' },
    });
    const result = await syncProperty({ repoPath: FIXTURE_PATH_WITH_ETAG });
    expect(result.status).toBe('content-modified');
    expect(result.localEtag).toBe('different-local-etag');
    expect(result.remoteEtag).toBe('remote-etag-xyz');
  });

  it('returns in-sync when versions match and no local etag stored', async () => {
    mockGetPropertyVersions.mockResolvedValue([
      { propertyVersion: 5, updatedDate: '2024-01-01' },
    ]);
    const result = await syncProperty({ repoPath: FIXTURE_PATH });
    expect(result.status).toBe('in-sync');
    expect(result.localEtag).toBeUndefined();
  });
});
