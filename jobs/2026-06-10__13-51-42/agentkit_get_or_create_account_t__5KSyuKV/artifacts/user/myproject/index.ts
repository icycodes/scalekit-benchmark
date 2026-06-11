import { ScalekitClient } from '@scalekit-sdk/node';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;

  if (!envUrl || !clientId || !clientSecret) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  console.log('Initializing ScalekitClient...');
  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  try {
    console.log('Calling getOrCreateConnectedAccount...');
    const response = await scalekit.connectedAccounts.getOrCreateConnectedAccount({
      connector: 'github-test',
      identifier: 'zealt-user01',
    });

    // Use a custom replacer to handle BigInt serialization
    const responseStr = JSON.stringify(response, (key, value) => {
      return typeof value === 'bigint' ? value.toString() : value;
    }, 2);
    console.log('Response:', responseStr);

    const connectedAccount = response.connectedAccount;
    if (!connectedAccount) {
      throw new Error('Connected account not found in response');
    }

    // Determine status string
    let statusStr = 'UNKNOWN';
    // Let's check what type status is and map it accordingly.
    // 1 is ACTIVE in ConnectorStatus enum.
    if (connectedAccount.status === 1 || String(connectedAccount.status).toUpperCase() === 'ACTIVE' || String(connectedAccount.status) === 'CONNECTION_STATUS_ACTIVE') {
      statusStr = 'ACTIVE';
    } else {
      statusStr = String(connectedAccount.status);
    }

    const logLines = [
      `Status: ${statusStr}`,
      `Connection: ${connectedAccount.connector || 'github-test'}`,
      `Identifier: ${connectedAccount.identifier || 'zealt-user01'}`,
      `Connected Account ID: ${connectedAccount.id}`
    ];

    const logContent = logLines.join('\n') + '\n';
    const logPath = '/home/user/myproject/output.log';
    fs.writeFileSync(logPath, logContent);
    console.log(`Successfully wrote log to ${logPath}`);
    console.log('Log Content:\n' + logContent);
  } catch (error) {
    console.error('Error executing Scalekit call:', error);
    process.exit(1);
  }
}

run();
