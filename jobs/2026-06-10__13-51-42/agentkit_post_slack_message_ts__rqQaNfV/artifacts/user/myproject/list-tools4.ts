import { ScalekitClient } from '@scalekit-sdk/node';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL!;
  const clientId = process.env.SCALEKIT_CLIENT_ID!;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET!;

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  const tools = await scalekit.tools.listTools({
    filter: {
      connector: 'slack-test',
      identifier: 'zealt-user01',
    },
    pageSize: 500,
  });
  console.log('Tools count:', tools.tools?.length);
  for (const t of tools.tools || []) {
    const def = (t as any).definition;
    console.log(`  ${def?.name} - ${def?.display_name}`);
  }
}

main().catch(console.error);
