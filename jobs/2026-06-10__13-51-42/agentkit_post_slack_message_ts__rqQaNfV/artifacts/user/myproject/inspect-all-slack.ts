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

  for (const t of tools.tools || []) {
    const def = (t as any).definition;
    console.log(`\n=== ${def?.name} ===`);
    console.log(`Display: ${def?.display_name}`);
    console.log(`Desc: ${def?.description}`);
    console.log(`Input props: ${Object.keys(def?.input_schema?.properties || {}).join(', ')}`);
    console.log(`Required: ${(def?.input_schema?.required || []).join(', ')}`);
    console.log(`Method: ${def?.rest_api_info?.method} ${def?.rest_api_info?.path_template}`);
  }
}

main().catch(console.error);
