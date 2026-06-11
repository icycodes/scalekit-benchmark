import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScalekitClient } from '@scalekit-sdk/node';

const CONNECTION_NAME = 'github-test';

interface Catalog {
  connection_name: typeof CONNECTION_NAME;
  identifiers: string[];
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function extractAccounts(response: unknown): unknown[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && typeof response === 'object') {
    const record = response as Record<string, unknown>;
    const candidateKeys = [
      'connectedAccounts',
      'connected_accounts',
      'accounts',
      'data',
      'items',
      'results',
    ];

    for (const key of candidateKeys) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }

  throw new Error('Unable to locate connected accounts array in Scalekit response');
}

function accountIdentifier(account: unknown): string | undefined {
  if (!account || typeof account !== 'object') {
    return undefined;
  }

  const identifier = (account as Record<string, unknown>).identifier;
  return typeof identifier === 'string' ? identifier : undefined;
}

async function main(): Promise<void> {
  const envUrl = requiredEnv('SCALEKIT_ENV_URL');
  const clientId = requiredEnv('SCALEKIT_CLIENT_ID');
  const clientSecret = requiredEnv('SCALEKIT_CLIENT_SECRET');

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);
  const response = await scalekit.actions.listConnectedAccounts({
    connectionName: CONNECTION_NAME,
  });

  const identifiers = extractAccounts(response)
    .map(accountIdentifier)
    .filter((identifier): identifier is string => Boolean(identifier))
    .sort((a, b) => a.localeCompare(b));

  const catalog: Catalog = {
    connection_name: CONNECTION_NAME,
    identifiers,
  };

  const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  await writeFile(
    path.join(projectDir, 'accounts.json'),
    `${JSON.stringify(catalog, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(projectDir, 'output.log'),
    `GitHub connected accounts: ${identifiers.length}\n`,
    'utf8',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
