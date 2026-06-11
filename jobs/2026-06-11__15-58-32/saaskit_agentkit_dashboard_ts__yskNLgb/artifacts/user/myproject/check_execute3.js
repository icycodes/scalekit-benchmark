const { ScalekitClient } = require('@scalekit-sdk/node');

async function run() {
  const client = new ScalekitClient(process.env.SCALEKIT_ENV_URL, process.env.SCALEKIT_CLIENT_ID, process.env.SCALEKIT_CLIENT_SECRET);
  const toolResponse = await client.tools.executeTool({
    toolName: 'github_user_repos_list',
    identifier: 'zealt-user01',
    connector: 'github-test',
    params: {
      per_page: 5
    }
  });
  console.log(toolResponse.data);
}
run().catch(console.error);
