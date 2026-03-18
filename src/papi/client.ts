import EdgeGrid from 'akamai-edgegrid';
import type {
  EdgeGridCredentials,
  PapiRuleTreeResponse,
  PapiValidationResponse,
  PapiVersionResponse,
  ActivationRequest,
  ActivationResponse,
  PapiError,
  PapiRule,
} from './types.js';

export class PapiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly papiError?: PapiError,
  ) {
    super(message);
    this.name = 'PapiClientError';
  }
}

export class PapiClient {
  private readonly credentials: EdgeGridCredentials;

  constructor(credentials: EdgeGridCredentials) {
    this.credentials = credentials;
  }

  async getRuleTree(propertyId: string, version?: number): Promise<PapiRuleTreeResponse> {
    const ver = version ?? (await this.getLatestVersion(propertyId));
    const path = `/papi/v1/properties/${propertyId}/versions/${ver}/rules`;
    return this.request<PapiRuleTreeResponse>('GET', path);
  }

  async validateRuleTree(propertyId: string, version: number, ruleTree: PapiRule): Promise<PapiValidationResponse> {
    // Fetch current rule tree to get its etag for optimistic concurrency
    const current = await this.getRuleTree(propertyId, version);
    const path = `/papi/v1/properties/${propertyId}/versions/${version}/rules?validateRules=true&validateMode=full`;
    return this.request<PapiValidationResponse>('PUT', path, { rules: ruleTree }, { 'If-Match': current.etag });
  }

  async getPropertyVersions(propertyId: string): Promise<PapiVersionResponse[]> {
    const path = `/papi/v1/properties/${propertyId}/versions`;
    const response = await this.request<{ versions: { items: PapiVersionResponse[] } }>('GET', path);
    return response.versions.items;
  }

  async getPropertyVersion(propertyId: string, version: number): Promise<PapiVersionResponse> {
    const path = `/papi/v1/properties/${propertyId}/versions/${version}`;
    const response = await this.request<{ versions: { items: PapiVersionResponse[] } }>('GET', path);
    const item = response.versions.items[0];
    if (!item) throw new PapiClientError(`Version ${version} not found`, 404);
    return item;
  }

  async activateProperty(request: ActivationRequest): Promise<ActivationResponse> {
    const path = `/papi/v1/properties/${request.propertyId}/activations`;
    const body = {
      propertyVersion: request.propertyVersion,
      network: request.network,
      note: request.note ?? 'Activated via papi-mcp',
      notifyEmails: request.notifyEmails ?? [],
      acknowledgeAllWarnings: request.acknowledgeAllWarnings ?? true,
      activationType: 'ACTIVATE',
      fastPush: true,
    };
    return this.request<ActivationResponse>('POST', path, body);
  }

  async getActivationStatus(propertyId: string, activationId: string): Promise<ActivationResponse> {
    const path = `/papi/v1/properties/${propertyId}/activations/${activationId}`;
    return this.request<ActivationResponse>('GET', path);
  }

  private async getLatestVersion(propertyId: string): Promise<number> {
    const versions = await this.getPropertyVersions(propertyId);
    if (versions.length === 0) throw new PapiClientError('No versions found', 404);
    // Sort descending and take first
    const sorted = [...versions].sort((a, b) => b.propertyVersion - a.propertyVersion);
    return sorted[0]!.propertyVersion;
  }

  private async request<T>(method: string, path: string, body?: unknown, additionalHeaders?: Record<string, string>): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...additionalHeaders,
    };

    const eg = new EdgeGrid(
      this.credentials.clientToken,
      this.credentials.clientSecret,
      this.credentials.accessToken,
      this.credentials.host,
    );

    return new Promise<T>((resolve, reject) => {
      eg.auth({
        path,
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      eg.send((error, _response, responseBody) => {
        if (error) {
          reject(new PapiClientError(`PAPI request failed: ${error.message}`, 0));
          return;
        }

        if (!responseBody) {
          reject(new PapiClientError('Empty response from PAPI', 0));
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(responseBody);
        } catch {
          reject(new PapiClientError('Failed to parse PAPI response', 0));
          return;
        }

        // Check for error response
        const maybeError = parsed as Record<string, unknown>;
        if (typeof maybeError['status'] === 'number' && maybeError['status'] >= 400) {
          const papiError: PapiError = {
            type: String(maybeError['type'] ?? ''),
            title: maybeError['title'] as string | undefined,
            status: maybeError['status'] as number,
            detail: String(maybeError['detail'] ?? 'Unknown error'),
            retryAfter: maybeError['retryAfter'] as number | undefined,
          };
          reject(new PapiClientError(papiError.detail, papiError.status, papiError));
          return;
        }

        resolve(parsed as T);
      });
    });
  }
}
