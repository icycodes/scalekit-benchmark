import { ScalekitClient } from '@scalekit-sdk/node';
import * as fs from 'fs';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
  const runId = process.env.ZEALT_RUN_ID;

  if (!envUrl || !clientId || !clientSecret) {
    console.error('Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET');
    process.exit(1);
  }

  if (!runId) {
    console.error('Missing required environment variable: ZEALT_RUN_ID');
    process.exit(1);
  }

  const channelName = `agentkit-demo-${runId}`;
  const messageText = `scalekit-agentkit-ts ${runId}`;

  console.log(`Channel name: ${channelName}`);
  console.log(`Message text: ${messageText}`);

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  const connector = 'slack-test';
  const identifier = 'zealt-user01';

  // Step 1: Try to create the channel via the proxy API with form-encoded body
  let channelId: string | undefined;

  console.log('Attempting to create channel via proxy API (form-encoded)...');
  try {
    const proxyResult = await scalekit.actions.request({
      connectionName: connector,
      identifier,
      path: '/api/conversations.create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `name=${encodeURIComponent(channelName)}`,
    });
    console.log('Proxy create channel status:', proxyResult.status);
    console.log('Proxy create channel data:', JSON.stringify(proxyResult.data, null, 2));
    if (proxyResult.data?.ok && proxyResult.data?.channel?.id) {
      channelId = proxyResult.data.channel.id;
      console.log(`Created channel via proxy: ${channelName} (ID: ${channelId})`);
    } else if (proxyResult.data?.error === 'name_taken') {
      console.log('Channel already exists (name_taken), searching for it...');
    } else {
      console.log(`Create channel returned: ok=${proxyResult.data?.ok}, error=${proxyResult.data?.error}`);
    }
  } catch (proxyErr: any) {
    console.log('Proxy API error:', proxyErr?.message || proxyErr);
  }

  // If channel creation failed, search for existing channel
  if (!channelId) {
    console.log('Searching for existing channel...');
    const listResult = await scalekit.actions.executeTool({
      toolName: 'slack_list_channels',
      toolInput: {
        types: 'public_channel,private_channel',
        limit: 1000,
      },
      identifier,
      connector,
    });

    const channels = (listResult.data as any)?.channels || [];
    const foundChannel = channels.find((c: any) => c.name === channelName);

    if (!foundChannel) {
      console.error(`Could not find or create channel: ${channelName}`);
      console.error(`Available channels: ${channels.map((c: any) => c.name).join(', ')}`);
      process.exit(1);
    }
    channelId = foundChannel.id;
    console.log(`Found existing channel: ${channelName} (ID: ${channelId})`);
  }

  // Step 2: Post message to the channel
  console.log('Posting message...');
  const postResult = await scalekit.actions.executeTool({
    toolName: 'slack_send_message',
    toolInput: {
      channel: channelId,
      text: messageText,
    },
    identifier,
    connector,
  });

  console.log('Post message data:', JSON.stringify(postResult.data, null, 2));

  const messageTs = (postResult.data as any)?.ts;
  if (!messageTs) {
    console.error('Failed to get message timestamp from response');
    process.exit(1);
  }

  // Write output.log
  const logContent = `Message TS: ${messageTs}\nChannel: ${channelName}\n`;
  fs.writeFileSync('/home/user/myproject/output.log', logContent);
  console.log('output.log written successfully');
  console.log(logContent);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
