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
const CONNECTION_NAME = "github-test";
const IDENTIFIER = "zealt-user01";
async function main() {
    const envUrl = process.env.SCALEKIT_ENV_URL;
    const clientId = process.env.SCALEKIT_CLIENT_ID;
    const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
    if (!envUrl || !clientId || !clientSecret) {
        console.error("Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET");
        process.exit(1);
    }
    const client = new node_1.ScalekitClient(envUrl, clientId, clientSecret);
    const response = await client.actions.getOrCreateConnectedAccount({
        connectionName: CONNECTION_NAME,
        identifier: IDENTIFIER,
    });
    const account = response.connectedAccount;
    if (!account) {
        console.error("No connected account returned in the response.");
        process.exit(1);
    }
    const statusName = connected_accounts_pb_1.ConnectorStatus[account.status] ?? "UNKNOWN";
    const logLines = [
        `Status: ${statusName}`,
        `Connection: ${account.connector}`,
        `Identifier: ${account.identifier}`,
        `Connected Account ID: ${account.id}`,
    ];
    const logContent = logLines.join("\n") + "\n";
    const logPath = path.resolve(__dirname, "..", "output.log");
    fs.writeFileSync(logPath, logContent, "utf-8");
    console.log(`Log written to ${logPath}`);
    console.log(logContent);
}
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
