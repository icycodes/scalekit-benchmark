const { ScalekitClient } = require('@scalekit-sdk/node');
const scalekit = new ScalekitClient(process.env.SCALEKIT_ENV_URL, process.env.SCALEKIT_CLIENT_ID, process.env.SCALEKIT_CLIENT_SECRET);
async function run() {
  try {
    const tools = await scalekit.tools.listScopedTools('zealt-user01', { filter: { connectionNames: ['github-test'] }, pageSize: 100 });
    console.log(JSON.stringify(tools, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
