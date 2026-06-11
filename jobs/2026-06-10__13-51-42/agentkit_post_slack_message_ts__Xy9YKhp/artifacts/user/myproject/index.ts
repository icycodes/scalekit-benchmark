import { ScalekitClient } from '@scalekit-sdk/node';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const envUrl = process.env.SCALEKIT_ENV_URL;
const clientId = process.env.SCALEKIT_CLIENT_ID;
const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
const runId = process.env.ZEALT_RUN_ID;

if (!envUrl || !clientId || !clientSecret || !runId) {
  console.error('Missing required environment variables:', {
    envUrl: !!envUrl,
    clientId: !!clientId,
    clientSecret: !!clientSecret,
    runId: !!runId
  });
  process.exit(1);
}

const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

async function main() {
  const channelName = `agentkit-demo-${runId}`;
  console.log(`Starting post Slack message process for run ID: ${runId}`);
  console.log(`Target channel name: ${channelName}`);

  let resolvedChannelId: string | undefined;

  try {
    // 1. Try to list existing channels to see if the target channel already exists
    console.log('Listing existing channels...');
    const listResult = await scalekit.actions.executeTool({
      toolName: 'slack_list_channels',
      toolInput: {
        types: 'public_channel,private_channel'
      },
      identifier: 'zealt-user01',
      connector: 'slack-test'
    });

    const channels = (listResult.data as any)?.channels || [];
    const existingChannel = channels.find((c: any) => c.name === channelName);

    if (existingChannel) {
      resolvedChannelId = existingChannel.id;
      console.log(`Found existing channel "${channelName}" with ID: ${resolvedChannelId}`);
    } else {
      console.log(`Channel "${channelName}" not found in channels list.`);
    }
  } catch (error) {
    console.error('Error listing channels:', error);
  }

  // 2. If the channel was not found, try to create it
  if (!resolvedChannelId) {
    try {
      console.log(`Attempting to create channel "${channelName}"...`);
      const createResult = await scalekit.actions.executeTool({
        toolName: 'slack_create_channel',
        toolInput: {
          name: channelName
        },
        identifier: 'zealt-user01',
        connector: 'slack-test'
      });

      console.log('Create channel response:', JSON.stringify(createResult.data, null, 2));
      resolvedChannelId = (createResult.data as any)?.channel?.id;

      if (resolvedChannelId) {
        console.log(`Successfully created channel "${channelName}" with ID: ${resolvedChannelId}`);
      } else {
        console.warn('Channel creation response did not contain channel ID.');
      }
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  }

  // 3. Fallback to using the channel name with '#' prefix if we couldn't resolve/create an ID
  const finalChannelLocator = resolvedChannelId || `#${channelName}`;
  console.log(`Using channel locator: ${finalChannelLocator}`);

  // 4. Post the message
  const messageText = `scalekit-agentkit-ts ${runId}`;
  console.log(`Posting message: "${messageText}"`);

  try {
    const postResult = await scalekit.actions.executeTool({
      toolName: 'slack_send_message',
      toolInput: {
        channel: finalChannelLocator,
        text: messageText
      },
      identifier: 'zealt-user01',
      connector: 'slack-test'
    });

    console.log('Post message response:', JSON.stringify(postResult.data, null, 2));

    const postData = postResult.data as any;
    const slackMessageTs = postData?.ts || postData?.timestamp || postData?.message?.ts;

    if (!slackMessageTs) {
      throw new Error('Failed to retrieve message timestamp (ts) from Slack response');
    }

    console.log(`Message successfully posted! Timestamp TS: ${slackMessageTs}`);

    // 5. Write to output.log
    const logFilePath = path.join(__dirname, 'output.log');
    const logContent = `Message TS: ${slackMessageTs}\nChannel: ${channelName}\n`;
    fs.writeFileSync(logFilePath, logContent, 'utf8');
    console.log(`Log written to ${logFilePath}`);

  } catch (error) {
    console.error('Error posting message or writing log:', error);
    process.exit(1);
  }
}

main();
