import 'dotenv/config';

import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ScalekitClient from '@scalekit-sdk/node';

const CONNECTION_NAME = 'github-test';
const LOG_FILE = join(process.cwd(), 'output.log');

const STATUS_NAMES: Record<number, string> = {
  0: 'CONNECTION_STATUS_UNSPECIFIED',
  1: 'ACTIVE',
  2: 'EXPIRED',
  3: 'PENDING_AUTH',
  4: 'PENDING_VERIFICATION',
  5: 'DISCONNECTED',
};

type ConnectedAccountSummary = {
  identifier?: string;
};

type ListConnectedAccountsResponseLike = {
  connectedAccounts?: ConnectedAccountSummary[];
  nextPageToken?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function statusToLogValue(status: unknown): string {
  if (typeof status === 'number') {
    return STATUS_NAMES[status] ?? String(status);
  }

  if (typeof status === 'string' && status.length > 0) {
    return status;
  }

  return 'UNKNOWN';
}

function appendLog(line: string): void {
  appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
}

async function identifierIsListed(
  scalekit: ScalekitClient,
  identifier: string,
): Promise<boolean> {
  let pageToken: string | undefined;

  do {
    const response = (await scalekit.actions.listConnectedAccounts({
      connectionName: CONNECTION_NAME,
      ...(pageToken ? { pageToken } : {}),
    })) as ListConnectedAccountsResponseLike;

    if (
      response.connectedAccounts?.some((account) => account.identifier === identifier)
    ) {
      return true;
    }

    pageToken = response.nextPageToken || undefined;
  } while (pageToken);

  return false;
}

async function main(): Promise<void> {
  const envUrl = requiredEnv('SCALEKIT_ENV_URL');
  const clientId = requiredEnv('SCALEKIT_CLIENT_ID');
  const clientSecret = requiredEnv('SCALEKIT_CLIENT_SECRET');
  const runId = requiredEnv('ZEALT_RUN_ID');
  const identifier = `zealt-cleanup-${runId}`;

  writeFileSync(LOG_FILE, '', 'utf8');

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  const created = await scalekit.actions.getOrCreateConnectedAccount({
    connectionName: CONNECTION_NAME,
    identifier,
  });
  appendLog(
    `Created account: connection=${CONNECTION_NAME} identifier=${identifier} status=${statusToLogValue(
      created.connectedAccount?.status,
    )}`,
  );

  const presentBeforeDelete = await identifierIsListed(scalekit, identifier);
  if (!presentBeforeDelete) {
    throw new Error(`Connected account ${identifier} was not listed before delete`);
  }
  appendLog(`Listed before delete: present=true identifier=${identifier}`);

  await scalekit.actions.deleteConnectedAccount({
    connectionName: CONNECTION_NAME,
    identifier,
  });
  appendLog(`Deleted account: connection=${CONNECTION_NAME} identifier=${identifier}`);

  const presentAfterDelete = await identifierIsListed(scalekit, identifier);
  if (presentAfterDelete) {
    throw new Error(`Connected account ${identifier} was still listed after delete`);
  }
  appendLog(`Listed after delete: present=false identifier=${identifier}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
