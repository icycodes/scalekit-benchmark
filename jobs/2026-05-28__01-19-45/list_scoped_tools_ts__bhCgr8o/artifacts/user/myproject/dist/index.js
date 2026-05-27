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
const ENV_URL = process.env.SCALEKIT_ENV_URL;
const CLIENT_ID = process.env.SCALEKIT_CLIENT_ID;
const CLIENT_SECRET = process.env.SCALEKIT_CLIENT_SECRET;
if (!ENV_URL || !CLIENT_ID || !CLIENT_SECRET) {
    console.error("Missing required environment variables: " +
        "SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET");
    process.exit(1);
}
const USER_ID = "zealt-user01";
const CONNECTIONS = ["github-test", "slack-test"];
const PAGE_SIZE = 100;
async function listAllToolsForConnection(scalekit, userId, connectionName) {
    const toolNames = [];
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
    let nextPageToken = response.nextPageToken || undefined;
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
    const scalekit = new node_1.ScalekitClient(ENV_URL, CLIENT_ID, CLIENT_SECRET);
    const catalog = {};
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
//# sourceMappingURL=index.js.map