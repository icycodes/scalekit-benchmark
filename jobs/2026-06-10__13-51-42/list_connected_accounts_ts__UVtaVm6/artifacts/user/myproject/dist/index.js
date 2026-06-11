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
    if (!envUrl) {
        console.error('Error: SCALEKIT_ENV_URL environment variable is missing.');
        process.exit(1);
    }
    if (!clientId) {
        console.error('Error: SCALEKIT_CLIENT_ID environment variable is missing.');
        process.exit(1);
    }
    if (!clientSecret) {
        console.error('Error: SCALEKIT_CLIENT_SECRET environment variable is missing.');
        process.exit(1);
    }
    console.log('Initializing Scalekit Client...');
    const scalekit = new node_1.ScalekitClient(envUrl, clientId, clientSecret);
    const connectionName = 'github-test';
    console.log(`Fetching connected accounts for connection: ${connectionName}`);
    const identifiers = [];
    let pageToken = '';
    try {
        do {
            const response = await scalekit.actions.listConnectedAccounts({
                connectionName,
                pageToken: pageToken || undefined,
            });
            if (response.connectedAccounts) {
                for (const account of response.connectedAccounts) {
                    if (account.identifier) {
                        identifiers.push(account.identifier);
                    }
                }
            }
            pageToken = response.nextPageToken || '';
        } while (pageToken !== '');
        // Ensure deterministic ordering and uniqueness
        const uniqueIdentifiers = Array.from(new Set(identifiers)).sort();
        console.log(`Found ${uniqueIdentifiers.length} connected accounts.`);
        const catalogPath = path.join('/home/user/myproject', 'accounts.json');
        const logPath = path.join('/home/user/myproject', 'output.log');
        const catalog = {
            connection_name: connectionName,
            identifiers: uniqueIdentifiers,
        };
        console.log(`Writing catalog to ${catalogPath}...`);
        fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
        console.log(`Writing summary log to ${logPath}...`);
        fs.writeFileSync(logPath, `GitHub connected accounts: ${uniqueIdentifiers.length}\n`, 'utf8');
        console.log('Task completed successfully!');
    }
    catch (error) {
        console.error('An error occurred while fetching connected accounts:', error);
        process.exit(1);
    }
}
main();
