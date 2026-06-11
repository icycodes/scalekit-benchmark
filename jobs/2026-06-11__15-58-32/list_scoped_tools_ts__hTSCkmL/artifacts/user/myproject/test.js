"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("@scalekit-sdk/node");
async function main() {
    const envUrl = process.env.SCALEKIT_ENV_URL || '';
    const clientId = process.env.SCALEKIT_CLIENT_ID || '';
    const clientSecret = process.env.SCALEKIT_CLIENT_SECRET || '';
    const scalekit = new node_1.ScalekitClient(envUrl, clientId, clientSecret);
    const githubTools = await scalekit.tools.listScopedTools('zealt-user01', {
        filter: {
            connectionNames: ['github-test']
        },
        pageSize: 100
    });
    console.log(JSON.stringify(githubTools, null, 2));
}
main().catch(console.error);
