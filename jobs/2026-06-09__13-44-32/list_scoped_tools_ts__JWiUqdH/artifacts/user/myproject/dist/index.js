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
async function main() {
    const envUrl = process.env.SCALEKIT_ENV_URL;
    const clientId = process.env.SCALEKIT_CLIENT_ID;
    const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
    if (!envUrl || !clientId || !clientSecret) {
        console.error('Missing standard environment variables for Scalekit Client.');
        process.exit(1);
    }
    const scalekit = new node_1.ScalekitClient(envUrl, clientId, clientSecret);
    const connections = ['github-test', 'slack-test'];
    const catalog = {
        'github-test': [],
        'slack-test': []
    };
    const userIdentifier = 'zealt-user01';
    for (const connection of connections) {
        let pageToken = '';
        const toolNames = [];
        do {
            const response = await scalekit.tools.listScopedTools(userIdentifier, {
                filter: {
                    connectionNames: [connection]
                },
                pageSize: 100,
                pageToken: pageToken || undefined
            });
            if (response.tools) {
                for (const scopedTool of response.tools) {
                    const name = scopedTool.tool?.definition?.name;
                    if (typeof name === 'string' && name) {
                        toolNames.push(name);
                    }
                }
            }
            pageToken = response.nextPageToken;
        } while (pageToken);
        // Sort and ensure unique tool names
        const uniqueToolNames = Array.from(new Set(toolNames)).sort();
        catalog[connection] = uniqueToolNames;
    }
    const projectDir = '/home/user/myproject';
    if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
    }
    // Write catalog file
    const catalogPath = path.join(projectDir, 'tools.json');
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
    // Write log file
    const logPath = path.join(projectDir, 'output.log');
    const logContent = [
        `GitHub tools: ${catalog['github-test'].length}`,
        `Slack tools: ${catalog['slack-test'].length}`
    ].join('\n') + '\n';
    fs.writeFileSync(logPath, logContent, 'utf8');
    console.log('Successfully generated tools.json and output.log.');
}
main().catch((err) => {
    console.error('An error occurred during tool enumeration:', err);
    process.exit(1);
});
