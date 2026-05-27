import { ScalekitClient } from '@scalekit-sdk/node';
import * as fs from 'fs';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL || '';
  const clientId = process.env.SCALEKIT_CLIENT_ID || '';
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET || '';

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);
  const userId = 'zealt-user01';
  
  try {
    const githubToolsResult = await scalekit.tools.listScopedTools(userId, {
      filter: { connectionNames: ['github-test'] },
      pageSize: 100
    });
    const githubTools = githubToolsResult.tools.map((t: any) => t.tool.definition.name);

    const slackToolsResult = await scalekit.tools.listScopedTools(userId, {
      filter: { connectionNames: ['slack-test'] },
      pageSize: 100
    });
    const slackTools = slackToolsResult.tools.map((t: any) => t.tool.definition.name);

    const catalog = {
      "github-test": githubTools,
      "slack-test": slackTools
    };

    fs.writeFileSync('/home/user/myproject/tools.json', JSON.stringify(catalog, null, 2));

    const logContent = `GitHub tools: ${githubTools.length}\nSlack tools: ${slackTools.length}\n`;
    fs.writeFileSync('/home/user/myproject/output.log', logContent);
    
  } catch(e: any) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
