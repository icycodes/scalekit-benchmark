import { ScalekitClient } from "@scalekit-sdk/node";
import * as fs from "fs";
import * as path from "path";

const ENV_URL = process.env.SCALEKIT_ENV_URL!;
const CLIENT_ID = process.env.SCALEKIT_CLIENT_ID!;
const CLIENT_SECRET = process.env.SCALEKIT_CLIENT_SECRET!;

const CONNECTION_NAME = "github-test";
const IDENTIFIER = "zealt-user01";
const LOG_FILE = path.resolve(__dirname, "..", "output.log");

async function main(): Promise<void> {
  // Initialize the Scalekit client
  const scalekitClient = new ScalekitClient(ENV_URL, CLIENT_ID, CLIENT_SECRET);

  // Step 1: Discover the tool name by listing scoped tools for the identifier
  // filtered by the github-test connection
  console.log(`Listing scoped tools for identifier="${IDENTIFIER}" with connection="${CONNECTION_NAME}"...`);

  const scopedTools = await scalekitClient.tools.listScopedTools(IDENTIFIER, {
    filter: {
      connectionNames: [CONNECTION_NAME],
    },
  });

  console.log(
    "Available scoped tools:",
    scopedTools.tools.map((t) => {
      const def = t.tool?.definition as Record<string, unknown> | undefined;
      return { id: t.tool?.id, name: def?.name };
    })
  );

  // Find a GitHub repo listing tool — prefer github_user_repos_list
  let toolName = "github_user_repos_list";
  const repoTool = scopedTools.tools.find((t) => {
    const def = t.tool?.definition as Record<string, unknown> | undefined;
    const name = def?.name as string | undefined;
    return name && (name.includes("user_repos") || name.includes("list_repos_for_authenticated"));
  });

  if (repoTool?.tool?.definition) {
    const def = repoTool.tool.definition as Record<string, unknown>;
    if (typeof def.name === "string") {
      toolName = def.name;
      console.log(`Using discovered tool name: ${toolName}`);
    }
  }

  // Step 2: Execute the tool to list repositories
  console.log(`Executing tool "${toolName}" for identifier="${IDENTIFIER}" with connection="${CONNECTION_NAME}"...`);

  const result = await scalekitClient.actions.executeTool({
    toolName,
    toolInput: {
      per_page: 100,
    },
    identifier: IDENTIFIER,
    connector: CONNECTION_NAME,
  });

  console.log("ExecuteTool response executionId:", result.executionId);

  // Step 3: Parse the response and write to log file
  const data = result.data as Record<string, unknown> | undefined;
  const lines: string[] = [];

  // The GitHub API response may have repos in different fields
  let repos: Array<Record<string, unknown>> = [];

  if (data) {
    if (Array.isArray(data.data)) {
      repos = data.data as Array<Record<string, unknown>>;
    } else if (Array.isArray(data.items)) {
      repos = data.items as Array<Record<string, unknown>>;
    } else if (Array.isArray(data.repositories)) {
      repos = data.repositories as Array<Record<string, unknown>>;
    } else if (Array.isArray(data)) {
      repos = data as unknown as Array<Record<string, unknown>>;
    } else {
      // Try to find any array field in the response
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
          repos = data[key] as Array<Record<string, unknown>>;
          break;
        }
      }
    }
  }

  // Write each repository name in the required format
  for (const repo of repos) {
    const name = (repo.name as string) || (repo.full_name as string) || "unknown";
    lines.push(`Repo: ${name}`);
  }
  lines.push(`Total: ${repos.length}`);

  // Also include the raw JSON for debugging
  lines.push("");
  lines.push("--- Raw Response ---");
  lines.push(JSON.stringify(data, null, 2));

  fs.writeFileSync(LOG_FILE, lines.join("\n"), "utf-8");
  console.log(`Log written to ${LOG_FILE}`);
  console.log(`Found ${repos.length} repositories.`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});