import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ScalekitClient } from '@scalekit-sdk/node';

const CONNECTION_NAME = 'github-test';
const IDENTIFIER = 'zealt-user01';
const OUTPUT_PATH = path.resolve(__dirname, '..', 'output.log');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function statusToString(status: unknown): string {
  if (typeof status === 'string') {
    return status;
  }

  const statusNames: Record<number, string> = {
    0: 'CONNECTION_STATUS_UNSPECIFIED',
    1: 'ACTIVE',
    2: 'EXPIRED',
    3: 'PENDING_AUTH',
    4: 'PENDING_VERIFICATION',
    5: 'DISCONNECTED',
  };

  if (typeof status === 'number') {
    return statusNames[status] ?? `UNKNOWN_STATUS_${status}`;
  }

  return String(status);
}

async function main(): Promise<void> {
  const client = new ScalekitClient(
    requireEnv('SCALEKIT_ENV_URL'),
    requireEnv('SCALEKIT_CLIENT_ID'),
    requireEnv('SCALEKIT_CLIENT_SECRET'),
  );

  const response = await client.connectedAccounts.getOrCreateConnectedAccount({
    connector: CONNECTION_NAME,
    identifier: IDENTIFIER,
  });

  const connectedAccount = response.connectedAccount;
  if (!connectedAccount) {
    throw new Error('Scalekit response did not include connectedAccount.');
  }

  const status = statusToString(connectedAccount.status);
  const connectedAccountId = connectedAccount.id;
  if (!connectedAccountId) {
    throw new Error('Scalekit connected account did not include a non-empty id.');
  }

  const lines = [
    `Status: ${status}`,
    `Connection: ${CONNECTION_NAME}`,
    `Identifier: ${IDENTIFIER}`,
    `Connected Account ID: ${connectedAccountId}`,
  ];

  await writeFile(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote Scalekit connected account verification to ${OUTPUT_PATH}`);
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  await writeFile(OUTPUT_PATH, `Error: ${message}\n`, 'utf8').catch(() => undefined);
  console.error(message);
  process.exitCode = 1;
});
