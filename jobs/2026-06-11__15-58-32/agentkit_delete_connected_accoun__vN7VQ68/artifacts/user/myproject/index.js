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
const connected_accounts_pb_1 = require("@scalekit-sdk/node/lib/pkg/grpc/scalekit/v1/connected_accounts/connected_accounts_pb");
const fs = __importStar(require("fs"));
async function main() {
    const envUrl = process.env.SCALEKIT_ENV_URL;
    const clientId = process.env.SCALEKIT_CLIENT_ID;
    const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
    const runId = process.env.ZEALT_RUN_ID;
    if (!envUrl || !clientId || !clientSecret || !runId) {
        console.error('Missing required environment variables.');
        process.exit(1);
    }
    const scalekit = new node_1.ScalekitClient(envUrl, clientId, clientSecret);
    const identifier = `zealt-cleanup-${runId}`;
    const connectionName = 'github-test';
    const logFile = '/home/user/myproject/output.log';
    const log = (msg) => {
        fs.appendFileSync(logFile, msg + '\n');
    };
    try {
        // 1. getOrCreateConnectedAccount
        const createRes = await scalekit.actions.getOrCreateConnectedAccount({
            connectionName,
            identifier
        });
        const statusVal = createRes.connectedAccount?.status;
        const statusStr = statusVal !== undefined ? connected_accounts_pb_1.ConnectorStatus[statusVal] : 'UNKNOWN';
        log(`Created account: connection=${connectionName} identifier=${identifier} status=${statusStr}`);
        // 2. listConnectedAccounts and check if present
        let presentBefore = false;
        let pageToken = undefined;
        do {
            const listRes = await scalekit.actions.listConnectedAccounts({
                connectionName,
                ...(pageToken ? { pageToken } : {})
            });
            if (listRes.connectedAccounts?.some(acc => acc.identifier === identifier)) {
                presentBefore = true;
                break;
            }
            pageToken = listRes.nextPageToken || undefined;
        } while (pageToken);
        log(`Listed before delete: present=${presentBefore} identifier=${identifier}`);
        // 3. deleteConnectedAccount
        await scalekit.actions.deleteConnectedAccount({
            connectionName,
            identifier
        });
        log(`Deleted account: connection=${connectionName} identifier=${identifier}`);
        // 4. listConnectedAccounts and confirm it's gone
        let presentAfter = false;
        pageToken = undefined;
        do {
            const listRes = await scalekit.actions.listConnectedAccounts({
                connectionName,
                ...(pageToken ? { pageToken } : {})
            });
            if (listRes.connectedAccounts?.some(acc => acc.identifier === identifier)) {
                presentAfter = true;
                break;
            }
            pageToken = listRes.nextPageToken || undefined;
        } while (pageToken);
        log(`Listed after delete: present=${presentAfter} identifier=${identifier}`);
        if (presentAfter) {
            console.error('Account was not deleted successfully');
            process.exit(1);
        }
        process.exit(0);
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
main();
