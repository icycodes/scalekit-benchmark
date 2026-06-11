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
      text: `Test message 2 - scalekit-agentkit-ts ${runId}`,
    },
    identifier: 'zealt-user01',
    connector: 'slack-test',
  });

  console.log('Full post result:');
  console.log(JSON.stringify(postResult, null, 2));

  // Also check the history to find the message
  const historyResult = await scalekit.actions.executeTool({
    toolName: 'slack_fetch_conversation_history',
    toolInput: {
      channel: 'C0ASKR76NRK',
      limit: 5,
    },
    identifier: 'zealt-user01',
    connector: 'slack-test',
  });

  console.log('\nLatest messages:');
  const messages = (historyResult.data as any)?.messages || [];
  for (const msg of messages.slice(0, 3)) {
    console.log(`  ts=${msg.ts} text=${msg.text?.substring(0, 50)}`);
  }
}

main().catch(console.error);
