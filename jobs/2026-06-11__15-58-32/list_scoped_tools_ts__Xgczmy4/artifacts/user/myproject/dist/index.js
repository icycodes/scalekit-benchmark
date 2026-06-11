"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("@scalekit-sdk/node");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PROJECT_DIR = path.resolve(__dirname, "..");
const TOOLS_JSON_PATH = path.join(PROJECT_DIR, "tools.json");
const OUTPUT_LOG_PATH = path.join(PROJECT_DIR, "output.log");
const USER_ID = "zealt-user01";
const CONNECTIONS = ["github-test", "slack-test"];
const PAGE_SIZE = 100;
async function listAllScopedTools(scalekit, userId, connectionName) {
    const toolNames = [];
    let pageToken = undefined;
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
            const definition = scopedTool?.tool?.definition;
            const name = definition && typeof definition["name"] === "string"
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
async function main() {
    const envUrl = process.env.SCALEKIT_ENV_URL;
    const clientId = process.env.SCALEKIT_CLIENT_ID;
    const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
    if (!envUrl || !clientId || !clientSecret) {
        throw new Error("Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET");
    }
    console.log(`Initializing Scalekit client for environment: ${envUrl}`);
    const scalekit = new node_1.ScalekitClient(envUrl, clientId, clientSecret);
    const catalog = {};
    for (const connection of CONNECTIONS) {
        console.log(`\nFetching scoped tools for user "${USER_ID}" on connection "${connection}"...`);
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
//# sourceMappingURL=index.js.map