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

describe('Activation workflow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('staging → production rejection → production success', async () => {
    // Step 1: Staging activation succeeds
    mockActivateProperty.mockResolvedValue({
      activationId: 'atv_staging',
      propertyId: '12345',
      propertyVersion: 5,
      network: 'STAGING',
      status: 'PENDING',
    });

    const stagingResult = await activateStaging({ repoPath: FIXTURE_PATH });
    expect(stagingResult.network).toBe('STAGING');
    expect(stagingResult.status).toBe('PENDING');

    // Step 2: Production without flag is rejected
    await expect(
      activateProduction({
        repoPath: FIXTURE_PATH,
        acknowledgeProductionRisk: false,
        contactEmails: ['team@example.com'],
      })
    ).rejects.toThrow('acknowledgeProductionRisk');

    // Verify no API call was made for rejected production
    expect(mockActivateProperty).toHaveBeenCalledTimes(1); // Only staging

    // Step 3: Production with flag succeeds
    mockActivateProperty.mockResolvedValue({
      activationId: 'atv_prod',
      propertyId: '12345',
      propertyVersion: 5,
      network: 'PRODUCTION',
      status: 'PENDING',
    });

    const prodResult = await activateProduction({
      repoPath: FIXTURE_PATH,
      acknowledgeProductionRisk: true,
      contactEmails: ['team@example.com'],
    });
    expect(prodResult.network).toBe('PRODUCTION');
    expect(prodResult.status).toBe('PENDING');
    expect(mockActivateProperty).toHaveBeenCalledTimes(2);
  });
});
