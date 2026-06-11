import { ScalekitClient } from '@scalekit-sdk/node';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL!;
  const clientId = process.env.SCALEKIT_CLIENT_ID!;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET!;
  const runId = process.env.ZEALT_RUN_ID!;

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  // Test sending a message to an existing channel
  const postResult = await scalekit.actions.executeTool({
    toolName: 'slack_send_message',
    toolInput: {
      channel: 'C0ASKR76NRK', // all-zealt-user01
      text: `Test message - scalekit-agentkit-ts ${runId}`,
    },
    identifier: 'zealt-user01',
    connector: 'slack-test',
  });

  console.log('Post result:', JSON.stringify(postResult, null, 2));
  console.log('Message TS:', (postResult.data as any)?.ts);
}

main().catch(console.error);
