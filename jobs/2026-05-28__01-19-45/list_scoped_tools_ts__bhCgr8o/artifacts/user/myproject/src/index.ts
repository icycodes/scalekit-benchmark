import { ScalekitClient } from "@scalekit-sdk/node";
import * as fs from "fs";
import * as path from "path";

const ENV_URL = process.env.SCALEKIT_ENV_URL;
const CLIENT_ID = process.env.SCALEKIT_CLIENT_ID;
const CLIENT_SECRET = process.env.SCALEKIT_CLIENT_SECRET;

if (!ENV_URL || !CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Missing required environment variables: " +
      "SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET"
  );
  process.exit(1);
}

const USER_ID = "zealt-user01";
const CONNECTIONS = ["github-test", "slack-test"] as const;
const PAGE_SIZE = 100;

async function listAllToolsForConnection(
  scalekit: ScalekitClient,
  userId: string,
  connectionName: string
): Promise<string[]> {
  const toolNames: string[] = [];

  console.log(`Fetching tools for connection: ${connectionName}, user: ${userId}`);

  // First page
  const response = await scalekit.tools.listScopedTools(userId, {
    filter: { connectionNames: [connectionName] },
    pageSize: PAGE_SIZE,
  });

  for (const scopedTool of response.tools ?? []) {
    const definition = scopedTool?.tool?.definition;
    const name = definition?.["name"];
    if (typeof name === "string" && name) {
      toolNames.push(name);
    }
  }

  // Handle pagination
  let nextPageToken: string | undefined =
    response.nextPageToken || undefined;

  while (nextPageToken) {
    console.log(`  Fetching next page for ${connectionName} (token: ${nextPageToken})...`);
    const nextResponse = await scalekit.tools.listScopedTools(userId, {
      filter: { connectionNames: [connectionName] },
      pageSize: PAGE_SIZE,
      pageToken: nextPageToken,
    });

    for (const scopedTool of nextResponse.tools ?? []) {
      const definition = scopedTool?.tool?.definition;
      const name = definition?.["name"];
      if (typeof name === "string" && name) {
        toolNames.push(name);
      }
    }

    nextPageToken = nextResponse.nextPageToken || undefined;
  }

  return toolNames;
}

async function main() {
  const scalekit = new ScalekitClient(ENV_URL!, CLIENT_ID!, CLIENT_SECRET!);

  const catalog: Record<string, string[]> = {};

  for (const connection of CONNECTIONS) {
    const tools = await listAllToolsForConnection(scalekit, USER_ID, connection);
    catalog[connection] = tools;
    console.log(`Found ${tools.length} tools for ${connection}`);
  }

  // Write the JSON catalog
  const catalogPath = path.join(__dirname, "..", "tools.json");
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");
  console.log(`\nCatalog written to: ${catalogPath}`);

  // Write the human-readable summary log
  const githubCount = catalog["github-test"].length;
  const slackCount = catalog["slack-test"].length;

  const logLines = [
    `GitHub tools: ${githubCount}`,
    `Slack tools: ${slackCount}`,
  ];

  const logPath = path.join(__dirname, "..", "output.log");
  fs.writeFileSync(logPath, logLines.join("\n") + "\n", "utf-8");
  console.log(`Log written to: ${logPath}`);

  console.log("\n=== Summary ===");
  logLines.forEach((line) => console.log(line));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
