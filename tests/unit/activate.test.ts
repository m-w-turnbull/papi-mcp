import { describe, it, expect, vi, beforeEach } from 'vitest';
import { activateStaging, activateProduction } from '../../src/tools/activate.js';

vi.mock('../../src/papi/auth.js', () => ({
  resolveCredentials: vi.fn().mockResolvedValue({
    clientSecret: 'test', host: 'test.luna.akamaiapis.net',
    accessToken: 'test', clientToken: 'test',
  }),
}));

const mockActivateProperty = vi.fn();
vi.mock('../../src/papi/client.js', () => ({
  PapiClient: vi.fn().mockImplementation(() => ({
    activateProperty: mockActivateProperty,
  })),
}));

const FIXTURE_PATH = new URL('../fixtures/sample-property', import.meta.url).pathname;

describe('activateStaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivateProperty.mockResolvedValue({
      activationId: 'atv_123',
      propertyId: '12345',
      propertyVersion: 5,
      network: 'STAGING',
      status: 'PENDING',
    });
  });

  it('activates staging with repoPath auto-detect', async () => {
    const result = await activateStaging({ repoPath: FIXTURE_PATH });
    expect(result.status).toBe('PENDING');
    expect(result.network).toBe('STAGING');
    expect(mockActivateProperty).toHaveBeenCalledWith(
      expect.objectContaining({ network: 'STAGING', propertyId: '12345' })
    );
  });

  it('activates staging with explicit propertyId', async () => {
    await activateStaging({ propertyId: 'prp_99999', version: 3 });
    expect(mockActivateProperty).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: 'prp_99999', propertyVersion: 3 })
    );
  });
});

describe('activateProduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivateProperty.mockResolvedValue({
      activationId: 'atv_456',
      propertyId: '12345',
      propertyVersion: 5,
      network: 'PRODUCTION',
      status: 'PENDING',
    });
  });

  it('rejects without acknowledgeProductionRisk', async () => {
    await expect(
      activateProduction({
        repoPath: FIXTURE_PATH,
        acknowledgeProductionRisk: false,
        contactEmails: ['team@example.com'],
      })
    ).rejects.toThrow('acknowledgeProductionRisk');
  });

  it('activates production with risk flag', async () => {
    const result = await activateProduction({
      repoPath: FIXTURE_PATH,
      acknowledgeProductionRisk: true,
      contactEmails: ['team@example.com'],
    });
    expect(result.status).toBe('PENDING');
    expect(result.network).toBe('PRODUCTION');
  });
});
