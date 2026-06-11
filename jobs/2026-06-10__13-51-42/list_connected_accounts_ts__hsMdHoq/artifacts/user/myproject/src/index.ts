import { ScalekitClient } from '@scalekit-sdk/node';

const CONNECTION_NAME = 'github-test';

async function main(): Promise<void> {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;

  if (!envUrl || !clientId || !clientSecret) {
    console.error(
      'Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET'
    );
    process.exit(1);
  }

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  const response = await scalekit.actions.listConnectedAccounts({
    connectionName: CONNECTION_NAME,
  });

  const identifiers: string[] = response.connectedAccounts.map(
    (account) => account.identifier
  );

  const catalog = {
    connection_name: CONNECTION_NAME,
    identifiers,
  };

  const fs = await import('fs/promises');
  const path = await import('path');

  const projectDir = path.resolve(__dirname, '..');

  // Write accounts.json
  const accountsJsonPath = path.join(projectDir, 'accounts.json');
  await fs.writeFile(
    accountsJsonPath,
    JSON.stringify(catalog, null, 2) + '\n',
    'utf-8'
  );
  console.log(`Wrote catalog to ${accountsJsonPath}`);

  // Write output.log
  const outputLogPath = path.join(projectDir, 'output.log');
  const count = identifiers.length;
  await fs.writeFile(
    outputLogPath,
    `GitHub connected accounts: ${count}\n`,
    'utf-8'
  );
  console.log(`Wrote summary to ${outputLogPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
