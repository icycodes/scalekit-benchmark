import * as fs from 'fs';
import * as path from 'path';
import { ScalekitClient } from '@scalekit-sdk/node';
import { ConnectorStatus } from '@scalekit-sdk/node/lib/pkg/grpc/scalekit/v1/connected_accounts/connected_accounts_pb';

const CONNECTION_NAME = 'github-test';
const LOG_FILE = path.join(__dirname, 'output.log');

function statusName(status: ConnectorStatus | number): string {
  // ConnectorStatus is a numeric enum; return its key name.
  const name = ConnectorStatus[status as number] as string | undefined;
  return name ?? String(status);
}

async function listAllIdentifiers(
  scalekit: ScalekitClient,
  connectionName: string
): Promise<string[]> {
  const identifiers: string[] = [];
  let pageToken: string | undefined;

  do {
    const resp = await scalekit.actions.listConnectedAccounts({
      connectionName,
      ...(pageToken ? { pageToken } : {}),
    });

    for (const acct of resp.connectedAccounts) {
      identifiers.push(acct.identifier);
    }

    pageToken = resp.nextPageToken || undefined;
  } while (pageToken);

  return identifiers;
}

async function main(): Promise<void> {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
  const runId = process.env.ZEALT_RUN_ID;

  if (!envUrl || !clientId || !clientSecret) {
    throw new Error(
      'Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET'
    );
  }
  if (!runId) {
    throw new Error('Missing required environment variable: ZEALT_RUN_ID');
  }

  const identifier = `zealt-cleanup-${runId}`;
  const logLines: string[] = [];

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  // Step 1: Get or create the connected account
  const createResp = await scalekit.actions.getOrCreateConnectedAccount({
    connectionName: CONNECTION_NAME,
    identifier,
  });

  const status = statusName(createResp.connectedAccount?.status ?? 0);
  const createLine = `Created account: connection=${CONNECTION_NAME} identifier=${identifier} status=${status}`;
  console.log(createLine);
  logLines.push(createLine);

  // Step 2: List before delete — confirm identifier is present
  const beforeIdentifiers = await listAllIdentifiers(scalekit, CONNECTION_NAME);
  const presentBefore = beforeIdentifiers.includes(identifier);
  const listBeforeLine = `Listed before delete: present=${presentBefore} identifier=${identifier}`;
  console.log(listBeforeLine);
  logLines.push(listBeforeLine);

  if (!presentBefore) {
    throw new Error(
      `Expected identifier ${identifier} to be present before delete, but it was not found.`
    );
  }

  // Step 3: Delete the connected account
  await scalekit.actions.deleteConnectedAccount({
    connectionName: CONNECTION_NAME,
    identifier,
  });

  const deleteLine = `Deleted account: connection=${CONNECTION_NAME} identifier=${identifier}`;
  console.log(deleteLine);
  logLines.push(deleteLine);

  // Step 4: List after delete — confirm identifier is gone
  const afterIdentifiers = await listAllIdentifiers(scalekit, CONNECTION_NAME);
  const presentAfter = afterIdentifiers.includes(identifier);
  const listAfterLine = `Listed after delete: present=${presentAfter} identifier=${identifier}`;
  console.log(listAfterLine);
  logLines.push(listAfterLine);

  if (presentAfter) {
    throw new Error(
      `Expected identifier ${identifier} to be absent after delete, but it was still found.`
    );
  }

  // Write all log lines to output.log
  fs.writeFileSync(LOG_FILE, logLines.join('\n') + '\n', 'utf8');
  console.log(`\nLog written to ${LOG_FILE}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
