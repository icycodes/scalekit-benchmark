import { ScalekitClient } from "@scalekit-sdk/node";
import * as fs from "fs";
import * as path from "path";

const CONNECTIONS = ["github-test", "slack-test"] as const;
const USER_IDENTIFIER = "zealt-user01";
const PAGE_SIZE = 100;

interface ToolCatalog {
  [connectionName: string]: string[];
}

async function main(): Promise<void> {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;

  if (!envUrl || !clientId || !clientSecret) {
    console.error(
      "Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET"
    );
    process.exit(1);
  }

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  const catalog: ToolCatalog = {};

  for (const connectionName of CONNECTIONS) {
    console.log(`Fetching scoped tools for connection: ${connectionName}...`);

    const response = await scalekit.tools.listScopedTools(USER_IDENTIFIER, {
      filter: { connectionNames: [connectionName] },
      pageSize: PAGE_SIZE,
    });

    const toolNames: string[] = [];

    for (const scopedTool of response.tools) {
      // The tool name lives inside the definition JSON object
      const definition = scopedTool.tool?.definition as Record<string, unknown> | undefined;
      const name = definition?.name;
      if (typeof name === "string") {
        toolNames.push(name);
      }
    }

    // Sort for deterministic output
    toolNames.sort();
    catalog[connectionName] = toolNames;

    console.log(`  Found ${toolNames.length} tools for ${connectionName}`);
  }

  // Write the JSON catalog
  const toolsJsonPath = path.join(__dirname, "..", "tools.json");
  fs.writeFileSync(toolsJsonPath, JSON.stringify(catalog, null, 2), "utf-8");
  console.log(`\nCatalog written to ${toolsJsonPath}`);

  // Write the summary log
  const logLines: string[] = [];
  for (const connectionName of CONNECTIONS) {
    const count = catalog[connectionName].length;
    // Capitalize the first letter of the connection name prefix for the log
    const prefix = connectionName.split("-")[0];
    const capitalized = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    logLines.push(`${capitalized} tools: ${count}`);
  }

  const outputLogPath = path.join(__dirname, "..", "output.log");
  fs.writeFileSync(outputLogPath, logLines.join("\n") + "\n", "utf-8");
  console.log(`Log written to ${outputLogPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
