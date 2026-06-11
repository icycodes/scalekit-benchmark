import { ScalekitClient } from '@scalekit-sdk/node';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;

  if (!envUrl || !clientId || !clientSecret) {
    console.error('Missing Scalekit environment variables.');
    process.exit(1);
  }

  const sk = new ScalekitClient(envUrl, clientId, clientSecret);

  console.log('Fetching GitHub repositories for zealt-user01 via github-test connection...');
  try {
    const result = await sk.actions.executeTool({
      toolName: 'github_user_repos_list',
      identifier: 'zealt-user01',
      toolInput: {
        per_page: 100,
      },
      connector: 'github-test',
    });

    console.log('Successfully executed tool!');

    // The data might be in result.data or result.data.array based on the API response structure
    let repos: any[] = [];
    if (result.data) {
      if (Array.isArray(result.data)) {
        repos = result.data;
      } else if (typeof result.data === 'object' && result.data !== null) {
        if (Array.isArray((result.data as any).array)) {
          repos = (result.data as any).array;
        } else if (Array.isArray((result.data as any).repositories)) {
          repos = (result.data as any).repositories;
        } else {
          // Check if any property of result.data is an array
          for (const key of Object.keys(result.data)) {
            if (Array.isArray((result.data as any)[key])) {
              repos = (result.data as any)[key];
              break;
            }
          }
        }
      }
    }

    console.log(`Found ${repos.length} repositories.`);

    // Build the log output
    let logContent = '';
    for (const repo of repos) {
      const repoName = repo.name || repo.fullName || 'unknown';
      logContent += `Repo: ${repoName}\n`;
    }
    logContent += `Total: ${repos.length}\n`;

    // Append raw JSON response for debugging
    logContent += '\n--- Raw JSON Response ---\n';
    logContent += JSON.stringify(result, null, 2) + '\n';

    const logFilePath = path.join(__dirname, '../output.log');
    fs.writeFileSync(logFilePath, logContent, 'utf-8');
    console.log(`Successfully wrote log to ${logFilePath}`);

  } catch (error) {
    console.error('Error fetching repositories:', error);
    process.exit(1);
  }
}

main();
