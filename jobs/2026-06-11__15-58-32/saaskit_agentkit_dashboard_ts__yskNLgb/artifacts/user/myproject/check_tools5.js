const { ScalekitClient } = require('@scalekit-sdk/node');

async function run() {
  const client = new ScalekitClient(process.env.SCALEKIT_ENV_URL, process.env.SCALEKIT_CLIENT_ID, process.env.SCALEKIT_CLIENT_SECRET);
  const res = await client.tools.listScopedTools('zealt-user01', { filter: { connectionNames: ['github-test'] }, pageSize: 100 });
  console.log(res.tools?.map(t => t.tool.definition.name));
}
run().catch(console.error);
