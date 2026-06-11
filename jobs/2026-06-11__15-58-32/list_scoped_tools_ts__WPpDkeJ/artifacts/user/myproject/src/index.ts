import { ScalekitClient } from "@scalekit-sdk/node";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL!;
  const clientId = process.env.SCALEKIT_CLIENT_ID!;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET!;

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  const identifier = "zealt-user01";
  const connections = ["github-test", "slack-test"] as const;
  const pageSize = 100;

  const catalog: Record<string, string[]> = {};

  for (const connectionName of connections) {
    let allToolNames: string[] = [];
    let pageToken: string | undefined;

    do {
      const response = await scalekit.tools.listScopedTools(identifier, {
        filter: {
          connectionNames: [connectionName],
        },
        pageSize,
        ...(pageToken ? { pageToken } : {}),
      });

      for (const scopedTool of response.tools) {
        const toolName = (scopedTool.tool?.definition as Record<string, any> | undefined)?.name;
        if (typeof toolName === "string") {
          allToolNames.push(toolName);
        }
      }

      pageToken = response.nextPageToken || undefined;
    } while (pageToken);

    // Deduplicate and sort for determinism
    allToolNames = [...new Set(allToolNames)].sort();
    catalog[connectionName] = allToolNames;
  }

  // Write tools.json
  const projectRoot = path.resolve(__dirname, "..");
  const catalogPath = path.join(projectRoot, "tools.json");
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");

  // Write output.log
  const logPath = path.join(projectRoot, "output.log");
  const githubCount = catalog["github-test"].length;
  const slackCount = catalog["slack-test"].length;
  const logLines = [
    `GitHub tools: ${githubCount}`,
    `Slack tools: ${slackCount}`,
  ];
  fs.writeFileSync(logPath, logLines.join("\n") + "\n");

  console.log(`Catalog written to ${catalogPath}`);
  console.log(`Log written to ${logPath}`);
  console.log(`GitHub tools: ${githubCount}`);
  console.log(`Slack tools: ${slackCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});