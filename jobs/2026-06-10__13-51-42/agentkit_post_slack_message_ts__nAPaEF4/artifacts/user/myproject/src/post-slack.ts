import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ScalekitClient } from '@scalekit-sdk/node';

const CONNECTION_NAME = 'slack-test';
const IDENTIFIER = 'zealt-user01';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function assertSlackOk(toolName: string, data: Record<string, unknown>): void {
  if (data.ok === false) {
    const error = getString(data.error) ?? JSON.stringify(data);
    throw new Error(`${toolName} returned Slack error: ${error}`);
  }
}

async function main(): Promise<void> {
  const envUrl = requiredEnv('SCALEKIT_ENV_URL');
  const clientId = requiredEnv('SCALEKIT_CLIENT_ID');
  const clientSecret = requiredEnv('SCALEKIT_CLIENT_SECRET');
  const runId = requiredEnv('ZEALT_RUN_ID');

  const channelName = `agentkit-demo-${runId}`;
  const messageText = `scalekit-agentkit-ts ${runId}`;
  const outputLogPath = join(process.cwd(), 'output.log');

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  async function executeSlackTool(
    toolName: string,
    toolInput: Record<string, unknown>,
    options: { allowSlackError?: boolean } = {},
  ): Promise<Record<string, unknown>> {
    const result = await scalekit.actions.executeTool({
      toolName,
      toolInput,
      identifier: IDENTIFIER,
      connector: CONNECTION_NAME,
    });

    const data = asRecord(result.data);
    if (!options.allowSlackError) {
      assertSlackOk(toolName, data);
    }
    return data;
  }

  async function findChannelIdByName(name: string): Promise<string | undefined> {
    let cursor: string | undefined;

    do {
      const input: Record<string, unknown> = {
        limit: 1000,
        types: 'public_channel,private_channel',
        exclude_archived: true,
      };
      if (cursor) {
        input.cursor = cursor;
      }

      const data = await executeSlackTool('slack_list_channels', input);
      const channels = Array.isArray(data.channels) ? data.channels : [];

      for (const rawChannel of channels) {
        const channel = asRecord(rawChannel);
        if (channel.name === name) {
          const id = getString(channel.id);
          if (!id) {
            throw new Error(`Found channel ${name}, but it did not include an id`);
          }
          return id;
        }
      }

      const metadata = asRecord(data.response_metadata);
      cursor = getString(metadata.next_cursor);
    } while (cursor);

    return undefined;
  }

  let channelId = await findChannelIdByName(channelName);

  if (!channelId) {
    const createData = await executeSlackTool(
      'slack_create_channel',
      {
        name: channelName,
        is_private: false,
      },
      { allowSlackError: true },
    );

    if (createData.ok === false && createData.error !== 'name_taken') {
      const error = getString(createData.error) ?? JSON.stringify(createData);
      const needed = getString(createData.needed);
      const provided = getString(createData.provided);
      throw new Error(
        [
          `slack_create_channel could not create ${channelName}: ${error}`,
          needed ? `needed scopes: ${needed}` : undefined,
          provided ? `provided scopes: ${provided}` : undefined,
        ]
          .filter(Boolean)
          .join('; '),
      );
    }

    const createdChannel = asRecord(createData.channel);
    channelId = getString(createdChannel.id) ?? getString(createData.channel);

    if (!channelId) {
      // If the channel was created concurrently or Slack reported name_taken as data,
      // look it up one more time before failing.
      channelId = await findChannelIdByName(channelName);
    }

    if (!channelId) {
      throw new Error(
        `Could not resolve channel id for ${channelName}; create response: ${JSON.stringify(createData)}`,
      );
    }
  }

  const sendData = await executeSlackTool('slack_send_message', {
    channel: channelId,
    text: messageText,
    unfurl_links: false,
    unfurl_media: false,
  });

  const messageTs = getString(sendData.ts) ?? getString(asRecord(sendData.message).ts);
  if (!messageTs) {
    throw new Error(`Slack send response did not include a message ts: ${JSON.stringify(sendData)}`);
  }

  writeFileSync(outputLogPath, '', 'utf8');
  appendFileSync(outputLogPath, `Message TS: ${messageTs}\n`, 'utf8');
  appendFileSync(outputLogPath, `Channel: ${channelName}\n`, 'utf8');

  console.log(`Posted Slack message ${messageTs} to ${channelName} (${channelId})`);
  console.log(`Wrote ${outputLogPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
