import { ScalekitClient } from '@scalekit-sdk/node';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;

  if (!envUrl) {
    console.error('Error: SCALEKIT_ENV_URL environment variable is missing.');
    process.exit(1);
  }
  if (!clientId) {
    console.error('Error: SCALEKIT_CLIENT_ID environment variable is missing.');
    process.exit(1);
  }
  if (!clientSecret) {
    console.error('Error: SCALEKIT_CLIENT_SECRET environment variable is missing.');
    process.exit(1);
  }

  console.log('Initializing Scalekit Client...');
  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  const connectionName = 'github-test';
  console.log(`Fetching connected accounts for connection: ${connectionName}`);

  const identifiers: string[] = [];
  let pageToken = '';

  try {
    do {
      const response = await scalekit.actions.listConnectedAccounts({
        connectionName,
        pageToken: pageToken || undefined,
      });

      if (response.connectedAccounts) {
        for (const account of response.connectedAccounts) {
          if (account.identifier) {
            identifiers.push(account.identifier);
          }
        }
      }

      pageToken = response.nextPageToken || '';
    } while (pageToken !== '');

    // Ensure deterministic ordering and uniqueness
    const uniqueIdentifiers = Array.from(new Set(identifiers)).sort();

    console.log(`Found ${uniqueIdentifiers.length} connected accounts.`);

    const catalogPath = path.join('/home/user/myproject', 'accounts.json');
    const logPath = path.join('/home/user/myproject', 'output.log');

    const catalog = {
      connection_name: connectionName,
      identifiers: uniqueIdentifiers,
    };

    console.log(`Writing catalog to ${catalogPath}...`);
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');

    console.log(`Writing summary log to ${logPath}...`);
    fs.writeFileSync(logPath, `GitHub connected accounts: ${uniqueIdentifiers.length}\n`, 'utf8');

    console.log('Task completed successfully!');
  } catch (error) {
    console.error('An error occurred while fetching connected accounts:', error);
    process.exit(1);
  }
}

main();
