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
    
    let repos: any[] = [];
    const data: any = result.data;
    if (data) {
       if (Array.isArray(data)) {
           repos = data;
       } else if (data.array && Array.isArray(data.array)) {
           repos = data.array;
       } else if (typeof data === 'string') {
           const parsed = JSON.parse(data);
           if (Array.isArray(parsed)) repos = parsed;
           else if (parsed.array) repos = parsed.array;
       } else if (data.listValue && data.listValue.values) {
           repos = data.listValue.values;
       } else {
           console.log("Unknown data structure", Object.keys(data));
       }
    }
    
    console.log(`Found ${repos.length} repos`);
    console.log("First repo:", JSON.stringify(repos[0], null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

main().then(() => console.log("Done")).catch(e => console.error(e));