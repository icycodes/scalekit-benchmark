import { ScalekitClient } from '@scalekit-sdk/node';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL!;
  const clientId = process.env.SCALEKIT_CLIENT_ID!;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET!;

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  // List tools with slack connector filter
  const tools = await scalekit.tools.listTools({
    filter: {
      connector: 'slack-test',
      identifier: 'zealt-user01',
    },
    pageSize: 500,
  });
  console.log('Tools count:', tools.tools?.length);
  for (const t of tools.tools || []) {
    console.log(JSON.stringify(t, null, 2));
    console.log('---');
  }
}

main().catch(console.error);
