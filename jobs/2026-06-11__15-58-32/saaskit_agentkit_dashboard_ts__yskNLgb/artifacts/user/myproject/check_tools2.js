const { ScalekitClient } = require('@scalekit-sdk/node');

async function run() {
  const client = new ScalekitClient(process.env.SCALEKIT_ENV_URL, process.env.SCALEKIT_CLIENT_ID, process.env.SCALEKIT_CLIENT_SECRET);
  const res = await client.tools.listTools({ pageSize: 100 });
  const repoTools = res.tools?.filter(t => JSON.stringify(t).includes('repo'));
  console.log(JSON.stringify(repoTools[0], null, 2));
}
run().catch(console.error);
