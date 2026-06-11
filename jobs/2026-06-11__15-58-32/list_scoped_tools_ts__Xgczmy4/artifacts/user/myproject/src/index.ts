import { ScalekitClient } from "@scalekit-sdk/node";
import * as fs from "fs";
import * as path from "path";

const PROJECT_DIR = path.resolve(__dirname, "..");
const TOOLS_JSON_PATH = path.join(PROJECT_DIR, "tools.json");
const OUTPUT_LOG_PATH = path.join(PROJECT_DIR, "output.log");

const USER_ID = "zealt-user01";
const CONNECTIONS = ["github-test", "slack-test"] as const;
const PAGE_SIZE = 100;

async function listAllScopedTools(
  scalekit: ScalekitClient,
  userId: string,
  connectionName: string
): Promise<string[]> {
  const toolNames: string[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const response = await scalekit.tools.listScopedTools(userId, {
      filter: {
        connectionNames: [connectionName],
      },
      pageSize: PAGE_SIZE,
      ...(pageToken ? { pageToken } : {}),
    });

    const tools = response.tools ?? [];
    for (const scopedTool of tools) {
      // tool.definition is a JsonObject (google.protobuf.Struct)
      const definition = scopedTool?.tool?.definition as
        | Record<string, unknown>
        | undefined;
      const name =
        definition && typeof definition["name"] === "string"
          ? definition["name"]
          : undefined;
      if (name) {
        toolNames.push(name);
      }
    }

    const next = response.nextPageToken;
    pageToken = next && next.length > 0 ? next : undefined;
  } while (pageToken);

  return toolNames;
}

async function main(): Promise<void> {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;

  if (!envUrl || !clientId || !clientSecret) {
    throw new Error(
      "Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET"
    );
  }

  console.log(`Initializing Scalekit client for environment: ${envUrl}`);
  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  const catalog: Record<string, string[]> = {};

  for (const connection of CONNECTIONS) {
    console.log(
      `\nFetching scoped tools for user "${USER_ID}" on connection "${connection}"...`
    );

    const toolNames = await listAllScopedTools(scalekit, USER_ID, connection);
    catalog[connection] = toolNames;

    console.log(`  → Found ${toolNames.length} tools for "${connection}"`);
    if (toolNames.length > 0) {
      console.log(`  → First few tools: ${toolNames.slice(0, 5).join(", ")}`);
    }
  }

  // Write the JSON catalog (deterministic, pretty-printed)
  fs.writeFileSync(TOOLS_JSON_PATH, JSON.stringify(catalog, null, 2), "utf-8");
  console.log(`\nCatalog written to: ${TOOLS_JSON_PATH}`);

  // Write the human-readable summary log
  const githubCount = catalog["github-test"]?.length ?? 0;
  const slackCount = catalog["slack-test"]?.length ?? 0;

  const logLines = [
    `GitHub tools: ${githubCount}`,
    `Slack tools: ${slackCount}`,
  ];

  fs.writeFileSync(OUTPUT_LOG_PATH, logLines.join("\n") + "\n", "utf-8");
  console.log(`Summary log written to: ${OUTPUT_LOG_PATH}`);

  console.log("\n=== Summary ===");
  logLines.forEach((line) => console.log(line));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
