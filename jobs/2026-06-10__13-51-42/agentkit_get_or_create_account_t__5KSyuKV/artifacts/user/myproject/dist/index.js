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
async function run() {
    const envUrl = process.env.SCALEKIT_ENV_URL;
    const clientId = process.env.SCALEKIT_CLIENT_ID;
    const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
    if (!envUrl || !clientId || !clientSecret) {
        console.error('Missing required environment variables');
        process.exit(1);
    }
    console.log('Initializing ScalekitClient...');
    const scalekit = new node_1.ScalekitClient(envUrl, clientId, clientSecret);
    try {
        console.log('Calling getOrCreateConnectedAccount...');
        const response = await scalekit.connectedAccounts.getOrCreateConnectedAccount({
            connector: 'github-test',
            identifier: 'zealt-user01',
        });
        // Use a custom replacer to handle BigInt serialization
        const responseStr = JSON.stringify(response, (key, value) => {
            return typeof value === 'bigint' ? value.toString() : value;
        }, 2);
        console.log('Response:', responseStr);
        const connectedAccount = response.connectedAccount;
        if (!connectedAccount) {
            throw new Error('Connected account not found in response');
        }
        // Determine status string
        let statusStr = 'UNKNOWN';
        // Let's check what type status is and map it accordingly.
        // 1 is ACTIVE in ConnectorStatus enum.
        if (connectedAccount.status === 1 || String(connectedAccount.status).toUpperCase() === 'ACTIVE' || String(connectedAccount.status) === 'CONNECTION_STATUS_ACTIVE') {
            statusStr = 'ACTIVE';
        }
        else {
            statusStr = String(connectedAccount.status);
        }
        const logLines = [
            `Status: ${statusStr}`,
            `Connection: ${connectedAccount.connector || 'github-test'}`,
            `Identifier: ${connectedAccount.identifier || 'zealt-user01'}`,
            `Connected Account ID: ${connectedAccount.id}`
        ];
        const logContent = logLines.join('\n') + '\n';
        const logPath = '/home/user/myproject/output.log';
        fs.writeFileSync(logPath, logContent);
        console.log(`Successfully wrote log to ${logPath}`);
        console.log('Log Content:\n' + logContent);
    }
    catch (error) {
        console.error('Error executing Scalekit call:', error);
        process.exit(1);
    }
}
run();
