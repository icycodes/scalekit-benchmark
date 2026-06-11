"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const node_1 = require("@scalekit-sdk/node");
const envUrl = process.env.SCALEKIT_ENV_URL || '';
const clientId = process.env.SCALEKIT_CLIENT_ID || '';
const clientSecret = process.env.SCALEKIT_CLIENT_SECRET || '';
const scalekitClient = new node_1.ScalekitClient(envUrl, clientId, clientSecret);
const app = (0, express_1.default)();
app.use((0, cookie_parser_1.default)());
app.get('/logout', (req, res) => {
    const idToken = req.cookies.idToken;
    const logoutUrl = scalekitClient.getLogoutUrl({
        idTokenHint: idToken,
        postLogoutRedirectUri: 'http://localhost:3000/goodbye',
    });
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('idToken');
    res.redirect(logoutUrl);
});
app.get('/goodbye', (_req, res) => {
    res.status(200).type('text/plain').send('Goodbye');
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
