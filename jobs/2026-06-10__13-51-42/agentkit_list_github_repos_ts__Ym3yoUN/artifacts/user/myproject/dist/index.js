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
require("dotenv/config");
async function main() {
    const envUrl = process.env.SCALEKIT_ENV_URL;
    const clientId = process.env.SCALEKIT_CLIENT_ID;
    const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
    if (!envUrl || !clientId || !clientSecret) {
        console.error('Missing Scalekit environment variables.');
        process.exit(1);
    }
    const sk = new node_1.ScalekitClient(envUrl, clientId, clientSecret);
    console.log('Fetching GitHub repositories for zealt-user01 via github-test connection...');
    try {
        const result = await sk.actions.executeTool({
            toolName: 'github_user_repos_list',
            identifier: 'zealt-user01',
            toolInput: {
                per_page: 100,
            },
            connector: 'github-test',
        });
        console.log('Successfully executed tool!');
        // The data might be in result.data or result.data.array based on the API response structure
        let repos = [];
        if (result.data) {
            if (Array.isArray(result.data)) {
                repos = result.data;
            }
            else if (typeof result.data === 'object' && result.data !== null) {
                if (Array.isArray(result.data.array)) {
                    repos = result.data.array;
                }
                else if (Array.isArray(result.data.repositories)) {
                    repos = result.data.repositories;
                }
                else {
                    // Check if any property of result.data is an array
                    for (const key of Object.keys(result.data)) {
                        if (Array.isArray(result.data[key])) {
                            repos = result.data[key];
                            break;
                        }
                    }
                }
            }
        }
        console.log(`Found ${repos.length} repositories.`);
        // Build the log output
        let logContent = '';
        for (const repo of repos) {
            const repoName = repo.name || repo.fullName || 'unknown';
            logContent += `Repo: ${repoName}\n`;
        }
        logContent += `Total: ${repos.length}\n`;
        // Append raw JSON response for debugging
        logContent += '\n--- Raw JSON Response ---\n';
        logContent += JSON.stringify(result, null, 2) + '\n';
        const logFilePath = path.join(__dirname, '../output.log');
        fs.writeFileSync(logFilePath, logContent, 'utf-8');
        console.log(`Successfully wrote log to ${logFilePath}`);
    }
    catch (error) {
        console.error('Error fetching repositories:', error);
        process.exit(1);
    }
}
main();
