import { ScalekitClient } from '@scalekit-sdk/node';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL!;
  const clientId = process.env.SCALEKIT_CLIENT_ID!;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET!;
  const runId = process.env.ZEALT_RUN_ID!;

  const channelName = `agentkit-demo-${runId}`;

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  const connector = 'slack-test';
  const identifier = 'zealt-user01';

  // List channels
  const listResult = await scalekit.actions.executeTool({
    toolName: 'slack_list_channels',
    toolInput: {
      types: 'public_channel,private_channel',
      limit: 1000,
    },
    identifier,
    connector,
  });

  console.log('List result:', JSON.stringify(listResult.data, null, 2));

  const channels = (listResult.data as any)?.channels || [];
  console.log(`Total channels: ${channels.length}`);

  const foundChannel = channels.find((c: any) => c.name === channelName);
  if (foundChannel) {
    console.log(`Found channel: ${channelName} (ID: ${foundChannel.id})`);
  } else {
    console.log(`Channel ${channelName} not found`);
  }

  // List all channel names
  console.log('\nAll channel names:');
  for (const c of channels) {
    console.log(`  ${c.name} (${c.id})`);
  }
}

main().catch(console.error);
