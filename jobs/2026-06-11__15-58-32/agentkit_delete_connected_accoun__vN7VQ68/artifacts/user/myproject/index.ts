import { ScalekitClient } from '@scalekit-sdk/node';
import { ConnectorStatus } from '@scalekit-sdk/node/lib/pkg/grpc/scalekit/v1/connected_accounts/connected_accounts_pb';
import * as fs from 'fs';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
  const runId = process.env.ZEALT_RUN_ID;

  if (!envUrl || !clientId || !clientSecret || !runId) {
    console.error('Missing required environment variables.');
    process.exit(1);
  }

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);
  const identifier = `zealt-cleanup-${runId}`;
  const connectionName = 'github-test';
  
  const logFile = '/home/user/myproject/output.log';
  const log = (msg: string) => {
    fs.appendFileSync(logFile, msg + '\n');
  };

  try {
    // 1. getOrCreateConnectedAccount
    const createRes = await scalekit.actions.getOrCreateConnectedAccount({
      connectionName,
      identifier
    });
    
    const statusVal = createRes.connectedAccount?.status;
    const statusStr = statusVal !== undefined ? ConnectorStatus[statusVal] : 'UNKNOWN';
    
    log(`Created account: connection=${connectionName} identifier=${identifier} status=${statusStr}`);

    // 2. listConnectedAccounts and check if present
    let presentBefore = false;
    let pageToken = undefined;

    do {
      const listRes = await scalekit.actions.listConnectedAccounts({
        connectionName,
        ...(pageToken ? { pageToken } : {})
      });
      
      if (listRes.connectedAccounts?.some(acc => acc.identifier === identifier)) {
        presentBefore = true;
        break;
      }
      
      pageToken = listRes.nextPageToken || undefined;
    } while (pageToken);

    log(`Listed before delete: present=${presentBefore} identifier=${identifier}`);

    // 3. deleteConnectedAccount
    await scalekit.actions.deleteConnectedAccount({
      connectionName,
      identifier
    });
    
    log(`Deleted account: connection=${connectionName} identifier=${identifier}`);

    // 4. listConnectedAccounts and confirm it's gone
    let presentAfter = false;
    pageToken = undefined;

    do {
      const listRes = await scalekit.actions.listConnectedAccounts({
        connectionName,
        ...(pageToken ? { pageToken } : {})
      });
      
      if (listRes.connectedAccounts?.some(acc => acc.identifier === identifier)) {
        presentAfter = true;
        break;
      }
      
      pageToken = listRes.nextPageToken || undefined;
    } while (pageToken);

    log(`Listed after delete: present=${presentAfter} identifier=${identifier}`);
    
    if (presentAfter) {
      console.error('Account was not deleted successfully');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
