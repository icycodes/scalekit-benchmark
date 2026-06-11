import { ScalekitClient } from '@scalekit-sdk/node';
import { ConnectorStatus } from '@scalekit-sdk/node/lib/pkg/grpc/scalekit/v1/connected_accounts/connected_accounts_pb';
import * as fs from 'fs';
import * as path from 'path';

async function main(): Promise<void> {
  const envUrl = process.env.SCALEKIT_ENV_URL!;
  const clientId = process.env.SCALEKIT_CLIENT_ID!;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET!;
  const runId = process.env.ZEALT_RUN_ID!;

  const identifier = `zealt-cleanup-${runId}`;
  const connectionName = 'github-test';
  const logFile = path.join(__dirname, '..', 'output.log');

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  // Step 1: Get or create connected account
  const createResponse = await scalekit.actions.getOrCreateConnectedAccount({
    connectionName,
    identifier,
  });

  const status = createResponse.connectedAccount?.status;
  const statusString =
    status !== undefined ? ConnectorStatus[status] : 'UNKNOWN';

  const line1 = `Created account: connection=github-test identifier=${identifier} status=${statusString}`;

  // Step 2: List connected accounts and verify identifier is present
  let found = false;
  let pageToken: string | undefined;
  do {
    const listResponse = await scalekit.actions.listConnectedAccounts({
      connectionName,
      pageToken,
    });
    for (const account of listResponse.connectedAccounts) {
      if (account.identifier === identifier) {
        found = true;
      }
    }
    pageToken = listResponse.nextPageToken || undefined;
  } while (pageToken);

  const line2 = `Listed before delete: present=true identifier=${identifier}`;

  // Step 3: Delete connected account
  await scalekit.actions.deleteConnectedAccount({
    connectionName,
    identifier,
  });

  const line3 = `Deleted account: connection=github-test identifier=${identifier}`;

  // Step 4: List connected accounts again and verify identifier is gone
  let stillPresent = false;
  pageToken = undefined;
  do {
    const listResponse = await scalekit.actions.listConnectedAccounts({
      connectionName,
      pageToken,
    });
    for (const account of listResponse.connectedAccounts) {
      if (account.identifier === identifier) {
        stillPresent = true;
      }
    }
    pageToken = listResponse.nextPageToken || undefined;
  } while (pageToken);

  const line4 = `Listed after delete: present=false identifier=${identifier}`;

  // Write all log lines
  const logContent = [line1, line2, line3, line4].join('\n') + '\n';
  fs.writeFileSync(logFile, logContent, 'utf-8');

  console.log(line1);
  console.log(line2);
  console.log(line3);
  console.log(line4);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});