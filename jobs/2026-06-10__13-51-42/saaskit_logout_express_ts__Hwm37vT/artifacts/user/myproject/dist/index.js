"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const node_1 = require("@scalekit-sdk/node");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Initialize ScalekitClient from environment variables
const envUrl = process.env.SCALEKIT_ENV_URL || '';
const clientId = process.env.SCALEKIT_CLIENT_ID || '';
const clientSecret = process.env.SCALEKIT_CLIENT_SECRET || '';
const scalekitClient = new node_1.ScalekitClient(envUrl, clientId, clientSecret);
// Use cookie-parser middleware
app.use((0, cookie_parser_1.default)());
app.get('/logout', (req, res) => {
    const idToken = req.cookies.idToken;
    // Build the Scalekit logout URL
    const logoutUrl = scalekitClient.getLogoutUrl({
        idTokenHint: idToken,
        postLogoutRedirectUri: 'http://localhost:3000/goodbye',
    });
    // Clear the three session cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('idToken');
    // Redirect to the Scalekit logout URL with HTTP 302
    res.redirect(logoutUrl);
});
app.get('/goodbye', (req, res) => {
    res.status(200).type('text/plain').send('Goodbye');
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
