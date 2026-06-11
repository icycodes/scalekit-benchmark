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
const path = __importStar(require("path"));
const LOG_FILE = path.join(process.cwd(), 'output.log');
function log(message) {
    fs.appendFileSync(LOG_FILE, message + '\n', 'utf-8');
    console.log(message);
}
async function main() {
    // Clear log file at start
    fs.writeFileSync(LOG_FILE, '', 'utf-8');
    const envUrl = process.env.SCALEKIT_ENV_URL;
    const clientId = process.env.SCALEKIT_CLIENT_ID;
    const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
    const runId = process.env.ZEALT_RUN_ID;
    if (!envUrl || !clientId || !clientSecret) {
        console.error('Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET');
        process.exit(1);
    }
    if (!runId) {
        console.error('Missing required environment variable: ZEALT_RUN_ID');
        process.exit(1);
    }
    const identifier = `zealt-cleanup-${runId}`;
    const connectionName = 'github-test';
    const client = new node_1.ScalekitClient(envUrl, clientId, clientSecret);
    // Step 1: Get or create the connected account
    const createResponse = await client.actions.getOrCreateConnectedAccount({
        connectionName,
        identifier,
    });
    const connectedAccount = createResponse.connectedAccount;
    if (!connectedAccount) {
        console.error('Failed to get or create connected account: no account returned');
        process.exit(1);
    }
    const status = connected_accounts_pb_1.ConnectorStatus[connectedAccount.status] || String(connectedAccount.status);
    log(`Created account: connection=${connectionName} identifier=${identifier} status=${status}`);
    // Step 2: List connected accounts and confirm the identifier appears
    let found = false;
    let pageToken = undefined;
    do {
        const listResponse = await client.actions.listConnectedAccounts({
            connectionName,
            pageToken,
        });
        for (const account of listResponse.connectedAccounts) {
            if (account.identifier === identifier) {
                found = true;
                break;
            }
        }
        if (found)
            break;
        pageToken = listResponse.nextPageToken || undefined;
    } while (pageToken);
    log(`Listed before delete: present=${found} identifier=${identifier}`);
    if (!found) {
        console.error('Connected account was not found in listing after creation');
        process.exit(1);
    }
    // Step 3: Delete the connected account
    await client.actions.deleteConnectedAccount({
        connectionName,
        identifier,
    });
    log(`Deleted account: connection=${connectionName} identifier=${identifier}`);
    // Step 4: List connected accounts again and confirm the identifier is gone
    let foundAfterDelete = false;
    pageToken = undefined;
    do {
        const listResponse = await client.actions.listConnectedAccounts({
            connectionName,
            pageToken,
        });
        for (const account of listResponse.connectedAccounts) {
            if (account.identifier === identifier) {
                foundAfterDelete = true;
                break;
            }
        }
        if (foundAfterDelete)
            break;
        pageToken = listResponse.nextPageToken || undefined;
    } while (pageToken);
    log(`Listed after delete: present=${foundAfterDelete} identifier=${identifier}`);
    if (foundAfterDelete) {
        console.error('Connected account still exists after deletion');
        process.exit(1);
    }
    console.log('All steps completed successfully');
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
