import { ScalekitClient } from '@scalekit-sdk/node';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL!;
  const clientId = process.env.SCALEKIT_CLIENT_ID!;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET!;

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  // List tools with slack connector filter
  console.log('--- List tools with connector=slack-test, identifier=zealt-user01 ---');
  const tools = await scalekit.tools.listTools({
    filter: {
      connector: 'slack-test',
      identifier: 'zealt-user01',
    },
    pageSize: 500,
  });
  console.log('Tools count:', tools.tools?.length);
  for (const t of tools.tools || []) {
    console.log(`  ${t.toolName} - ${t.summary}`);
  }

  // Also try with provider filter
  console.log('\n--- List tools with provider=slack ---');
  const tools2 = await scalekit.tools.listTools({
    filter: {
      provider: 'slack',
    },
    pageSize: 500,
  });
  console.log('Tools count:', tools2.tools?.length);
  for (const t of tools2.tools || []) {
    console.log(`  ${t.toolName} - ${t.summary}`);
  }
}

main().catch(console.error);
