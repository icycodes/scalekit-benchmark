import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ScalekitClient } from "@scalekit-sdk/node";

const IDENTIFIER = "zealt-user01";
const CONNECTION_NAME = "github-test";
const OUTPUT_LOG = resolve(process.cwd(), "output.log");
const PER_PAGE = 100;

const TOOL_NAME_CANDIDATES = [
  "github_list_repos_for_authenticated_user",
  "github_user_repos_list",
  "github_repos_list_for_authenticated_user",
  "github_list_user_repositories",
];

type JsonRecord = Record<string, unknown>;

type Repo = {
  name: string;
  [key: string]: unknown;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function getDefinitionName(scopedTool: unknown): string | undefined {
  const scopedToolRecord = asRecord(scopedTool);
  const tool = asRecord(scopedToolRecord?.tool);
  const definition = asRecord(tool?.definition);
  const name = definition?.name;
  return typeof name === "string" ? name : undefined;
}

async function discoverRepositoryListTool(client: ScalekitClient): Promise<string> {
  const scopedTools = await client.tools.listScopedTools(IDENTIFIER, {
    filter: { connectionNames: [CONNECTION_NAME] },
    pageSize: 100,
  });

  const toolNames = (scopedTools.tools ?? [])
    .map(getDefinitionName)
    .filter((name): name is string => Boolean(name));

  const candidate = TOOL_NAME_CANDIDATES.find((name) => toolNames.includes(name));
  if (candidate) {
    return candidate;
  }

  const fallback = toolNames.find((name) => {
    const normalized = name.toLowerCase();
    return (
      normalized.includes("github") &&
      normalized.includes("repo") &&
      (normalized.includes("list") || normalized.includes("user"))
    );
  });

  if (fallback) {
    return fallback;
  }

  throw new Error(
    `Unable to find a GitHub repository listing tool for ${IDENTIFIER} on ${CONNECTION_NAME}. Available tools: ${toolNames.join(", ")}`,
  );
}

function extractArrayPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  const record = asRecord(data);
  if (!record) {
    return [];
  }

  const arrayFields = ["array", "items", "repositories", "repos", "data", "results"];
  for (const field of arrayFields) {
    const value = record[field];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function extractRepositories(data: unknown): Repo[] {
  const payload = extractArrayPayload(data);
  return payload.flatMap((item) => {
    const record = asRecord(item);
    if (record && typeof record.name === "string") {
      return [record as Repo];
    }
    return [];
  });
}

async function main(): Promise<void> {
  const client = new ScalekitClient(
    requiredEnv("SCALEKIT_ENV_URL"),
    requiredEnv("SCALEKIT_CLIENT_ID"),
    requiredEnv("SCALEKIT_CLIENT_SECRET"),
  );

  const toolName = await discoverRepositoryListTool(client);

  const result = await client.actions.executeTool({
    toolName,
    identifier: IDENTIFIER,
    connector: CONNECTION_NAME,
    toolInput: {
      per_page: PER_PAGE,
    },
  });

  const repositories = extractRepositories(result.data);
  const repoLines = repositories.map((repo) => `Repo: ${repo.name}`);

  const logLines = [
    ...repoLines,
    `Total: ${repositories.length}`,
    "",
    `Tool: ${toolName}`,
    `Identifier: ${IDENTIFIER}`,
    `Connection: ${CONNECTION_NAME}`,
    `Execution ID: ${result.executionId}`,
    "",
    "Raw response:",
    JSON.stringify(result, null, 2),
    "",
  ];

  await writeFile(OUTPUT_LOG, logLines.join("\n"), "utf8");

  console.log(`Wrote ${repositories.length} repositories to ${OUTPUT_LOG}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
