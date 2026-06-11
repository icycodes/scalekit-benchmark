const { ScalekitClient } = require('@scalekit-sdk/node');

async function run() {
  const client = new ScalekitClient(process.env.SCALEKIT_ENV_URL, process.env.SCALEKIT_CLIENT_ID, process.env.SCALEKIT_CLIENT_SECRET);
  const res = await client.tools.listScopedTools('zealt-user01', { filter: { connectionNames: ['github-test'] }, pageSize: 100 });
  const tool = res.tools?.find(t => t.tool.definition.name === 'github_user_repos_list');
  console.log(JSON.stringify(tool.tool.definition.input_schema, null, 2));
}
run().catch(console.error);
