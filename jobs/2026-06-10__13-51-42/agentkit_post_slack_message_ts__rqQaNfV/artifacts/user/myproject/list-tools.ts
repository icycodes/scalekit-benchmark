import { ScalekitClient } from '@scalekit-sdk/node';

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL!;
  const clientId = process.env.SCALEKIT_CLIENT_ID!;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET!;

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  // List all tools
  const allTools = await scalekit.tools.listTools({
    pageSize: 500,
  });
  console.log('All tools count:', allTools.tools?.length);
  const slackTools = allTools.tools?.filter((t: any) => t.toolName?.startsWith('slack'));
  console.log('Slack tools:');
  for (const t of slackTools || []) {
    console.log(`  ${t.toolName} - ${t.summary}`);
  }

  // Also list scoped tools for the identifier
  console.log('\n--- Scoped tools for zealt-user01 with slack-test ---');
  const scopedTools = await scalekit.tools.listScopedTools('zealt-user01', {
    filter: { connectionName: 'slack-test' },
    pageSize: 500,
  });
  console.log('Scoped tools count:', scopedTools.tools?.length);
  for (const t of scopedTools.tools || []) {
    console.log(`  ${t.toolName} - ${t.summary}`);
  }
}

main().catch(console.error);
