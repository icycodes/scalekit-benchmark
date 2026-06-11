const { ScalekitClient } = require('@scalekit-sdk/node');

async function run() {
  const client = new ScalekitClient(process.env.SCALEKIT_ENV_URL, process.env.SCALEKIT_CLIENT_ID, process.env.SCALEKIT_CLIENT_SECRET);
  const res = await client.tools.listTools({ pageSize: 100 });
  const githubTools = res.tools?.filter(t => t.provider === 'GITHUB');
  console.log(githubTools?.map(t => t.definition.name));
}
run().catch(console.error);
