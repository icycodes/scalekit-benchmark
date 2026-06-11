import { Scalekit } from '@scalekit-sdk/node';
import * as fs from 'fs';

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
       }
    }
    
    const lines: string[] = [];
    repos.forEach(repo => {
        lines.push(`Repo: ${repo.name}`);
    });
    lines.push(`Total: ${repos.length}`);
    
    // Optional: include raw JSON response
    lines.push('');
    lines.push('--- Raw JSON Response ---');
    lines.push(JSON.stringify(result, null, 2));

    fs.writeFileSync('/home/user/myproject/output.log', lines.join('\n'));
    console.log("Successfully wrote to /home/user/myproject/output.log");
  } catch (error) {
    console.error("Error:", error);
  }
}

main().then(() => console.log("Done")).catch(e => console.error(e));