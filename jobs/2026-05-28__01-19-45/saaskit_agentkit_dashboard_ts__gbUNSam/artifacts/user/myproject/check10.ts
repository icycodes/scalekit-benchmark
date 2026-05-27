import { ScalekitClient } from '@scalekit-sdk/node';
const scalekit = new ScalekitClient(process.env.SCALEKIT_ENV_URL || 'https://example.com', process.env.SCALEKIT_CLIENT_ID || 'client_id', process.env.SCALEKIT_CLIENT_SECRET || 'client_secret');
async function run() {
  try {
    const tools = await scalekit.tools.listScopedTools('zealt-user01', { filter: { connectionNames: ['github-test'] }, pageSize: 100 });
    console.log(JSON.stringify(tools, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
