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

  // Find slack_create_channel
  for (const t of tools.tools || []) {
    const def = (t as any).definition;
    if (def?.name === 'slack_create_channel') {
      console.log('=== slack_create_channel ===');
      console.log(JSON.stringify(def, null, 2));
    }
    if (def?.name === 'slack_send_message') {
      console.log('=== slack_send_message ===');
      console.log(JSON.stringify(def, null, 2));
    }
  }
}

main().catch(console.error);
