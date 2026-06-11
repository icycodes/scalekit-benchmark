import { ScalekitClient } from "@scalekit-sdk/node";
import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;

  if (!envUrl || !clientId || !clientSecret) {
    console.error(
      "Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET"
    );
    process.exit(1);
  }

  const client = new ScalekitClient(envUrl, clientId, clientSecret);

  const IDENTIFIER = "zealt-user01";
  const CONNECTION = "github-test";

  // Step 1: List scoped tools to discover the GitHub repo-listing tool name
  console.log("Listing scoped tools for identifier:", IDENTIFIER);
  const scopedTools = await client.tools.listScopedTools(IDENTIFIER, {
    filter: {
      connectionNames: [CONNECTION],
    },
    pageSize: 50,
  });

  const tools = scopedTools.tools ?? [];
  console.log(`Found ${tools.length} scoped tool(s):`);
  for (const t of tools) {
    const tool = (t as any).tool;
    console.log(
      `  id=${tool?.id} | name=${tool?.definition?.display_name} | provider=${tool?.provider}`
    );
  }

  // Find the GitHub repo listing tool - looking for "List Repositories" or similar
  const repoTool = tools.find((t: any) => {
    const displayName = t.tool?.definition?.display_name ?? "";
    const toolId = t.tool?.id ?? "";
    return (
      displayName.toLowerCase().includes("repositor") ||
      toolId.toLowerCase().includes("repo") ||
      displayName.toLowerCase().includes("list repo")
    );
  });

  if (!repoTool) {
    console.error(
      "Could not find a GitHub repository listing tool."
    );
    process.exit(1);
  }

  const toolId: string = (repoTool as any).tool?.id;
  console.log(`Using tool ID: ${toolId}`);

  // Step 2: Execute the tool to get repos
  console.log("Executing tool to fetch repositories...");
  const result = await client.actions.executeTool({
    toolName: toolId,
    toolInput: {
      per_page: 100,
    },
    identifier: IDENTIFIER,
    connector: CONNECTION,
  });

  // Step 3: Extract repository names from the response
  const data = result.data as any;
  console.log("Response type:", typeof data);
  console.log("Is array:", Array.isArray(data));
  if (typeof data === "object" && data !== null) {
    console.log("Keys:", Object.keys(data));
  }

  let repos: any[] = [];

  if (Array.isArray(data)) {
    repos = data;
  } else if (data && Array.isArray(data.data)) {
    repos = data.data;
  } else if (data && Array.isArray(data.repositories)) {
    repos = data.repositories;
  } else if (data && Array.isArray(data.items)) {
    repos = data.items;
  } else {
    // Try to find any array in the response
    for (const key of Object.keys(data || {})) {
      if (Array.isArray(data[key])) {
        repos = data[key];
        console.log(`Found array in key: ${key}, length: ${repos.length}`);
        break;
      }
    }
  }

  // Step 4: Write to output.log
  const logPath = path.resolve("/home/user/myproject/output.log");
  const lines: string[] = [];

  for (const repo of repos) {
    const name = repo.name ?? repo.full_name ?? repo.fullName ?? "unknown";
    lines.push(`Repo: ${name}`);
  }

  lines.push(`Total: ${repos.length}`);

  // Append raw JSON for debugging
  lines.push("");
  lines.push("--- Raw JSON Response ---");
  lines.push(JSON.stringify(data, null, 2));

  fs.writeFileSync(logPath, lines.join("\n") + "\n", "utf-8");
  console.log(`Wrote ${repos.length} repositories to ${logPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
