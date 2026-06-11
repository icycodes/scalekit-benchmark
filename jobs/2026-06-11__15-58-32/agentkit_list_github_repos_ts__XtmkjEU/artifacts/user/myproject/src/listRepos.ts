import { ScalekitClient } from '@scalekit-sdk/node';
import * as fs from 'fs';
import * as path from 'path';

const IDENTIFIER = 'zealt-user01';
const CONNECTION = 'github-test';
const TOOL_NAME = 'github_user_repos_list';
const LOG_FILE = path.resolve(__dirname, '..', 'output.log');

async function main(): Promise<void> {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;

  if (!envUrl || !clientId || !clientSecret) {
    throw new Error(
      'Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET'
    );
  }

  console.log(`Initializing Scalekit client for ${envUrl}`);
  const client = new ScalekitClient(envUrl, clientId, clientSecret);

  // Discover available tools for this identifier and connection to confirm tool name
  console.log(`Listing scoped tools for identifier="${IDENTIFIER}" connector="${CONNECTION}"...`);
  let resolvedToolName = TOOL_NAME;
  try {
    const scopedTools = await client.tools.listScopedTools(IDENTIFIER, {
      filter: { connectionNames: [CONNECTION] },
      pageSize: 50,
    });

    const tools = scopedTools.tools ?? [];
    console.log(`Found ${tools.length} scoped tool(s):`);
    for (const st of tools) {
      const name = (st.tool?.definition?.['name'] as string) ?? st.tool?.id ?? '(unknown)';
      console.log(`  - ${name}`);
    }

    // Try to find the exact tool; fall back gracefully
    const match = tools.find((st) => {
      const name = (st.tool?.definition?.['name'] as string) ?? '';
      return (
        name === TOOL_NAME ||
        name.includes('user_repos') ||
        name.includes('list_repos') ||
        name.includes('list_repositories')
      );
    });
    if (match) {
      resolvedToolName = (match.tool?.definition?.['name'] as string) ?? TOOL_NAME;
      console.log(`Using tool: ${resolvedToolName}`);
    } else {
      console.log(`Tool "${TOOL_NAME}" not found in scoped list; attempting with hardcoded name anyway.`);
    }
  } catch (err) {
    console.warn('listScopedTools failed (non-fatal):', (err as Error).message);
    console.log(`Proceeding with hardcoded tool name: ${resolvedToolName}`);
  }

  // Execute the tool
  console.log(`\nExecuting tool "${resolvedToolName}" for identifier="${IDENTIFIER}", connector="${CONNECTION}"...`);
  const response = await client.actions.executeTool({
    toolName: resolvedToolName,
    identifier: IDENTIFIER,
    connector: CONNECTION,
    toolInput: { per_page: 100, page: 1 },
  });

  const data = response.data ?? {};
  console.log('\nRaw response data keys:', Object.keys(data));

  // Extract repository list — the API returns an array directly or nested in a key
  // Common shapes: data itself is an array, or data.repositories / data.items / data.result
  let repos: Array<Record<string, unknown>> = [];

  if (Array.isArray(data)) {
    repos = data as Array<Record<string, unknown>>;
  } else {
    // Try common wrapper keys
    const candidateKeys = ['repositories', 'items', 'result', 'repos', 'data'];
    for (const key of candidateKeys) {
      if (Array.isArray(data[key])) {
        repos = data[key] as Array<Record<string, unknown>>;
        console.log(`Extracted repos from data["${key}"]`);
        break;
      }
    }
    // If still empty, try values that are arrays
    if (repos.length === 0) {
      for (const [key, val] of Object.entries(data)) {
        if (Array.isArray(val) && val.length > 0) {
          repos = val as Array<Record<string, unknown>>;
          console.log(`Extracted repos from data["${key}"] (auto-detect)`);
          break;
        }
      }
    }
  }

  console.log(`\nTotal repositories found: ${repos.length}`);

  // Build log content
  const lines: string[] = [];
  for (const repo of repos) {
    const name =
      (repo['name'] as string) ??
      (repo['full_name'] as string) ??
      (repo['id'] as string) ??
      String(repo);
    lines.push(`Repo: ${name}`);
  }
  lines.push(`Total: ${repos.length}`);

  // Append raw JSON for debugging
  lines.push('');
  lines.push('--- Raw JSON Response ---');
  lines.push(JSON.stringify(data, null, 2));

  const logContent = lines.join('\n') + '\n';
  fs.writeFileSync(LOG_FILE, logContent, 'utf8');

  console.log(`\nLog written to: ${LOG_FILE}`);
  console.log('Repository list:');
  repos.forEach((r) => {
    console.log(`  Repo: ${(r['name'] as string) ?? r['full_name'] ?? r['id']}`);
  });
  console.log(`Total: ${repos.length}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
