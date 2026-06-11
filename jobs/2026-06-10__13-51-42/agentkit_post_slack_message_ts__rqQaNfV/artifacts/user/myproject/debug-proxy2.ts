import { ScalekitClient } from '@scalekit-sdk/node';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL!;
  const clientId = process.env.SCALEKIT_CLIENT_ID!;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET!;
  const runId = process.env.ZEALT_RUN_ID!;

  const channelName = `agentkit-demo-${runId}`;

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  // Try with JSON body (no custom headers)
  try {
    const proxyResult = await scalekit.actions.request({
      connectionName: 'slack-test',
      identifier: 'zealt-user01',
      path: '/api/conversations.create',
      method: 'POST',
      body: {
        name: channelName,
      },
    });
    console.log('Status:', proxyResult.status);
    console.log('Data:', JSON.stringify(proxyResult.data, null, 2));
  } catch (err: any) {
    console.error('Error type:', err?.constructor?.name);
    console.error('Message:', err?.message);
    console.error('HTTP Status:', err?.httpStatus);
    if (err?.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

main().catch(console.error);
