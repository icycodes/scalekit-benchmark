import { ScalekitClient } from '@scalekit-sdk/node';
import * as fs from 'fs';
import * as path from 'path';

const envUrl = process.env.SCALEKIT_ENV_URL!;
const clientId = process.env.SCALEKIT_CLIENT_ID!;
const clientSecret = process.env.SCALEKIT_CLIENT_SECRET!;

if (!envUrl || !clientId || !clientSecret) {
  console.error('Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET');
  process.exit(1);
}

const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);
const userId = 'zealt-user01';
const connections = ['github-test', 'slack-test'];
const projectPath = '/home/user/myproject';

async function listTools() {
  const catalog: Record<string, string[]> = {};
  const logs: string[] = [];

  for (const connection of connections) {
    try {
      console.log(`Fetching tools for connection: ${connection}`);
      
      const provider = connection.startsWith('github') ? 'github' : 'slack';
      
      // I'll try to find all available tool names by paginating listTools()
      
      let allToolNames: string[] = [];
      let nextToken: string | undefined = undefined;
      do {
        const allToolsResponse: any = await scalekit.tools.listTools({ pageSize: 100, pageToken: nextToken });
        allToolNames.push(...allToolsResponse.tools
          .map((t: any) => t.definition?.name)
          .filter((name: any): name is string => typeof name === 'string' && name.startsWith(provider)));
        nextToken = allToolsResponse.nextPageToken;
      } while (nextToken);

      console.log(`Found ${allToolNames.length} potential tools for ${connection}`);

      // The error "no providers or tool names or connection names specified in filter"
      // seems to persist. I'll try to pass the filter properties at the top level AND inside a filter object.
      // @ts-ignore
      const response = await scalekit.tools.listScopedTools(userId, connection, {
        pageSize: 100,
        providerNames: [provider],
        connectionNames: [connection],
        toolNames: allToolNames,
        // Using lowercase 'filter' with the actual filter properties
        filter: {
          provider_names: [provider],
          connection_names: [connection],
          tool_names: allToolNames
        }
      });

      const toolNames = response.tools
        .map(t => t.tool?.definition?.name)
        .filter((name): name is string => typeof name === 'string');
      
      catalog[connection] = toolNames;

      if (connection === 'github-test') {
        logs.push(`GitHub tools: ${toolNames.length}`);
      } else if (connection === 'slack-test') {
        logs.push(`Slack tools: ${toolNames.length}`);
      }
    } catch (error) {
      console.error(`Error fetching tools for ${connection}:`, error);
      process.exit(1);
    }
  }

  // Write catalog to tools.json
  fs.writeFileSync(
    path.join(projectPath, 'tools.json'),
    JSON.stringify(catalog, null, 2)
  );

  // Write logs to output.log
  fs.writeFileSync(
    path.join(projectPath, 'output.log'),
    logs.join('\n') + '\n'
  );

  console.log('Successfully generated tools.json and output.log');
}

listTools().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
