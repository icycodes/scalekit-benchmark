import * as fs from 'fs';
import * as path from 'path';
import { ScalekitClient } from '@scalekit-sdk/node';
import { ConnectorStatus } from '@scalekit-sdk/node/lib/pkg/grpc/scalekit/v1/connected_accounts/connected_accounts_pb';

const LOG_FILE_PATH = path.join(__dirname, 'output.log');

// Truncate or initialize the log file
fs.writeFileSync(LOG_FILE_PATH, '');

function logStep(line: string) {
  console.log(line);
  fs.appendFileSync(LOG_FILE_PATH, line + '\n');
}

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
  const runId = process.env.ZEALT_RUN_ID;

  if (!envUrl || !clientId || !clientSecret) {
    throw new Error('Missing Scalekit environment variables (SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET)');
  }

  if (!runId) {
    throw new Error('Missing ZEALT_RUN_ID environment variable');
  }

  const identifier = `zealt-cleanup-${runId}`;
  const connectionName = 'github-test';

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  // Helper to search for identifier across all pages
  async function checkPresence(): Promise<boolean> {
    let pageToken: string | undefined = undefined;
    do {
      const response = await scalekit.actions.listConnectedAccounts({
        connectionName,
        pageSize: 50,
        pageToken
      });
      const found = response.connectedAccounts?.some(acc => acc.identifier === identifier);
      if (found) {
        return true;
      }
      pageToken = response.nextPageToken || undefined;
    } while (pageToken);
    return false;
  }

  // Step 1: Get or create connected account
  const createRes = await scalekit.actions.getOrCreateConnectedAccount({
    connectionName,
    identifier
  });
  const acc = createRes.connectedAccount;
  if (!acc) {
    throw new Error('Failed to retrieve or create connected account');
  }
  const statusStr = ConnectorStatus[acc.status] || String(acc.status);
  logStep(`Created account: connection=${connectionName} identifier=${identifier} status=${statusStr}`);

  // Step 2: List connected accounts before delete
  const presentBefore = await checkPresence();
  logStep(`Listed before delete: present=${presentBefore} identifier=${identifier}`);

  // Step 3: Delete connected account
  await scalekit.actions.deleteConnectedAccount({
    connectionName,
    identifier
  });
  logStep(`Deleted account: connection=${connectionName} identifier=${identifier}`);

  // Step 4: List connected accounts after delete
  const presentAfter = await checkPresence();
  logStep(`Listed after delete: present=${presentAfter} identifier=${identifier}`);
}

main().catch(err => {
  console.error('Error executing job:', err);
  process.exit(1);
});
