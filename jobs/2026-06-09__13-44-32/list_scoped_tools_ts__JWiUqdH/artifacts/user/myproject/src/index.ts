import { ScalekitClient } from '@scalekit-sdk/node';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;

  if (!envUrl || !clientId || !clientSecret) {
    console.error('Missing standard environment variables for Scalekit Client.');
    process.exit(1);
  }

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  const connections = ['github-test', 'slack-test'] as const;
  const catalog: { 'github-test': string[]; 'slack-test': string[] } = {
    'github-test': [],
    'slack-test': []
  };

  const userIdentifier = 'zealt-user01';

  for (const connection of connections) {
    let pageToken = '';
    const toolNames: string[] = [];

    do {
      const response = await scalekit.tools.listScopedTools(userIdentifier, {
        filter: {
          connectionNames: [connection]
        },
        pageSize: 100,
        pageToken: pageToken || undefined
      });

      if (response.tools) {
        for (const scopedTool of response.tools) {
          const name = scopedTool.tool?.definition?.name;
          if (typeof name === 'string' && name) {
            toolNames.push(name);
          }
        }
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    // Sort and ensure unique tool names
    const uniqueToolNames = Array.from(new Set(toolNames)).sort();
    catalog[connection] = uniqueToolNames;
  }

  const projectDir = '/home/user/myproject';
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Write catalog file
  const catalogPath = path.join(projectDir, 'tools.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');

  // Write log file
  const logPath = path.join(projectDir, 'output.log');
  const logContent = [
    `GitHub tools: ${catalog['github-test'].length}`,
    `Slack tools: ${catalog['slack-test'].length}`
  ].join('\n') + '\n';
  fs.writeFileSync(logPath, logContent, 'utf8');

  console.log('Successfully generated tools.json and output.log.');
}

main().catch((err) => {
  console.error('An error occurred during tool enumeration:', err);
  process.exit(1);
});
