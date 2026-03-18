import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import type { EdgeGridCredentials } from './types.js';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

interface ResolveOptions {
  edgercPath?: string;
  section?: string;
}

export async function resolveCredentials(options: ResolveOptions = {}): Promise<EdgeGridCredentials> {
  const section = options.section ?? 'default';

  // Try .edgerc file first
  const edgercPath = options.edgercPath ?? resolve(homedir(), '.edgerc');
  try {
    const content = await readFile(edgercPath, 'utf-8');
    return parseEdgerc(content, section);
  } catch {
    // File not found or unreadable, try env vars
  }

  // Try environment variables
  const clientSecret = process.env['AKAMAI_CLIENT_SECRET'];
  const host = process.env['AKAMAI_HOST'];
  const accessToken = process.env['AKAMAI_ACCESS_TOKEN'];
  const clientToken = process.env['AKAMAI_CLIENT_TOKEN'];

  if (clientSecret && host && accessToken && clientToken) {
    return { clientSecret, host, accessToken, clientToken };
  }

  throw new AuthError(
    `Could not resolve Akamai credentials. Provide either:\n` +
    `  1. An .edgerc file at ${edgercPath} (section: [${section}])\n` +
    `  2. Environment variables: AKAMAI_CLIENT_SECRET, AKAMAI_HOST, AKAMAI_ACCESS_TOKEN, AKAMAI_CLIENT_TOKEN`
  );
}

export function parseEdgerc(content: string, section: string): EdgeGridCredentials {
  const lines = content.split('\n');
  let inSection = false;
  const values: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    // Section header
    const sectionMatch = trimmed.match(/^\[(.+)]$/);
    if (sectionMatch) {
      inSection = sectionMatch[1] === section;
      continue;
    }

    if (!inSection) continue;
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    values[key] = value;
  }

  const clientSecret = values['client_secret'];
  const host = values['host']?.replace(/\/$/, '');
  const accessToken = values['access_token'];
  const clientToken = values['client_token'];

  if (!clientSecret || !host || !accessToken || !clientToken) {
    const missing: string[] = [];
    if (!clientSecret) missing.push('client_secret');
    if (!host) missing.push('host');
    if (!accessToken) missing.push('access_token');
    if (!clientToken) missing.push('client_token');
    throw new AuthError(
      `Incomplete credentials in .edgerc section [${section}]. Missing: ${missing.join(', ')}`
    );
  }

  return { clientSecret, host, accessToken, clientToken };
}
