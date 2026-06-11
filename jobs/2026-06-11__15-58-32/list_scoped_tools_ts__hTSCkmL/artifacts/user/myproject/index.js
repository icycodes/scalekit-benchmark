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
/// <reference types="node" />
const node_1 = require("@scalekit-sdk/node");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function fetchAllTools(scalekit, connectionName) {
    let allTools = [];
    let pageToken = undefined;
    do {
        const response = await scalekit.tools.listScopedTools('zealt-user01', {
            filter: {
                connectionNames: [connectionName]
            },
            pageSize: 100,
            pageToken
        });
        if (response.tools) {
            for (const t of response.tools) {
                if (t.tool?.definition?.name) {
                    allTools.push(t.tool.definition.name);
                }
            }
        }
        pageToken = response.nextPageToken || undefined;
    } while (pageToken);
    return allTools;
}
async function main() {
    const envUrl = process.env.SCALEKIT_ENV_URL || '';
    const clientId = process.env.SCALEKIT_CLIENT_ID || '';
    const clientSecret = process.env.SCALEKIT_CLIENT_SECRET || '';
    const scalekit = new node_1.ScalekitClient(envUrl, clientId, clientSecret);
    const githubTools = await fetchAllTools(scalekit, 'github-test');
    const slackTools = await fetchAllTools(scalekit, 'slack-test');
    const catalog = {
        'github-test': githubTools,
        'slack-test': slackTools
    };
    fs.writeFileSync(path.join(__dirname, 'tools.json'), JSON.stringify(catalog, null, 2));
    const logContent = `GitHub tools: ${githubTools.length}\nSlack tools: ${slackTools.length}\n`;
    fs.writeFileSync(path.join(__dirname, 'output.log'), logContent);
}
main().catch(console.error);
