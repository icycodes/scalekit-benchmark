/// <reference types="node" />
import { ScalekitClient } from '@scalekit-sdk/node';
import * as fs from 'fs';
import * as path from 'path';

async function fetchAllTools(scalekit: ScalekitClient, connectionName: string) {
  let allTools: string[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const response = await scalekit.tools.listScopedTools('zealt-user01', {
      filter: {
        connectionNames: [connectionName]
      },
      pageSize: 100,
      pageToken
    });

    if (response.tools) {
      for (const t of response.tools) {
        if (t.tool?.definition?.name) {
          allTools.push(t.tool.definition.name as string);
        }
      }
    }

    pageToken = response.nextPageToken || undefined;
  } while (pageToken);

  return allTools;
}

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL || '';
  const clientId = process.env.SCALEKIT_CLIENT_ID || '';
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET || '';

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);
  
  const githubTools = await fetchAllTools(scalekit, 'github-test');
  const slackTools = await fetchAllTools(scalekit, 'slack-test');

  const catalog = {
    'github-test': githubTools,
    'slack-test': slackTools
  };

  fs.writeFileSync(path.join(__dirname, 'tools.json'), JSON.stringify(catalog, null, 2));

  const logContent = `GitHub tools: ${githubTools.length}\nSlack tools: ${slackTools.length}\n`;
  fs.writeFileSync(path.join(__dirname, 'output.log'), logContent);
}

main().catch(console.error);
