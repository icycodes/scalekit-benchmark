import { writeFile } from "node:fs/promises";
import { ScalekitClient } from "@scalekit-sdk/node";
const USER_ID = "zealt-user01";
const CONNECTIONS = ["github-test", "slack-test"];
const PAGE_SIZE = 100;
function requiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
function extractTools(response) {
    if (Array.isArray(response)) {
        return response;
    }
    const typedResponse = response;
    if (Array.isArray(typedResponse.tools)) {
        return typedResponse.tools;
    }
    return [];
}
function extractNextPageToken(response) {
    const typedResponse = response;
    const token = typedResponse.nextPageToken ?? typedResponse.next_page_token;
    return typeof token === "string" && token.length > 0 ? token : undefined;
}
async function listAllToolNames(scalekit, connectionName) {
    const names = new Set();
    let pageToken;
    do {
        const response = await scalekit.tools.listScopedTools(USER_ID, {
            filter: {
                connectionNames: [connectionName],
            },
            pageSize: PAGE_SIZE,
            ...(pageToken ? { pageToken } : {}),
        });
        for (const scopedTool of extractTools(response)) {
            const name = scopedTool.tool?.definition?.name;
            if (typeof name === "string" && name.length > 0) {
                names.add(name);
            }
        }
        pageToken = extractNextPageToken(response);
    } while (pageToken);
    return [...names].sort();
}
async function main() {
    const envUrl = requiredEnv("SCALEKIT_ENV_URL");
    const clientId = requiredEnv("SCALEKIT_CLIENT_ID");
    const clientSecret = requiredEnv("SCALEKIT_CLIENT_SECRET");
    const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);
    const catalog = {
        "github-test": [],
        "slack-test": [],
    };
    for (const connectionName of CONNECTIONS) {
        catalog[connectionName] = await listAllToolNames(scalekit, connectionName);
    }
    const logLines = [
        `GitHub tools: ${catalog["github-test"].length}`,
        `Slack tools: ${catalog["slack-test"].length}`,
    ];
    await writeFile("tools.json", `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
    await writeFile("output.log", `${logLines.join("\n")}\n`, "utf8");
    console.log(logLines.join("\n"));
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
