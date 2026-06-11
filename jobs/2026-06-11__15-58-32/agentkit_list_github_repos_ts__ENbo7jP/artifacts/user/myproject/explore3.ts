import { Scalekit } from '@scalekit-sdk/node';

async function main() {
  const scalekit = new Scalekit(
    process.env.SCALEKIT_ENV_URL!,
    process.env.SCALEKIT_CLIENT_ID!,
    process.env.SCALEKIT_CLIENT_SECRET!
  );

  const identifier = 'zealt-user01';
  const connectionName = 'github-test';

  try {
    const result = await scalekit.actions.executeTool({
      identifier,
      connector: connectionName,
      toolName: 'github_user_repos_list',
      toolInput: { per_page: 100 }
    });
    
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

main().then(() => console.log("Done")).catch(e => console.error(e));