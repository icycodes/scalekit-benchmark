const { ScalekitClient } = require('@scalekit-sdk/node');

async function run() {
  const client = new ScalekitClient(process.env.SCALEKIT_ENV_URL, process.env.SCALEKIT_CLIENT_ID, process.env.SCALEKIT_CLIENT_SECRET);
  const res = await client.tools.listTools({ pageSize: 100 });
  console.log("Tools count:", res.tools?.length);
  const repoTools = res.tools?.filter(t => JSON.stringify(t).includes('repo'));
  console.log(JSON.stringify(repoTools?.map(t => t.toolName || t.name || t.tool?.name), null, 2));
}
run().catch(console.error);
