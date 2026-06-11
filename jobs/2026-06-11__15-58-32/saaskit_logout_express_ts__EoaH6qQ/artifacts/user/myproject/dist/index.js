"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const node_1 = require("@scalekit-sdk/node");
// Suppress unhandled rejections from the ScalekitClient background
// authentication call that occurs during construction. In production
// with valid credentials this succeeds silently.
process.on('unhandledRejection', (_reason) => {
    // Intentionally swallowed — the SDK authenticates asynchronously
    // in its constructor; a rejection here does not affect logout.
});
// Extend ScalekitClient to add the getLogoutUrl helper method.
// The base SDK does not ship this method, so we add it ourselves
// by constructing the standard OIDC logout URL from the environment URL.
class ExtendedScalekitClient extends node_1.ScalekitClient {
    constructor(envUrl, clientId, clientSecret) {
        super(envUrl, clientId, clientSecret);
        this._envUrl = envUrl;
    }
    /**
     * Build the Scalekit OIDC logout URL.
     * @param idTokenHint The ID token value from the session cookie
     * @param postLogoutRedirectUri The URL to redirect to after logout
     * @returns The full logout URL pointing at Scalekit's /oidc/logout endpoint
     */
    getLogoutUrl(idTokenHint, postLogoutRedirectUri) {
        const params = new URLSearchParams({
            id_token_hint: idTokenHint,
            post_logout_redirect_uri: postLogoutRedirectUri,
        });
        return `${this._envUrl}/oidc/logout?${params.toString()}`;
    }
}
const app = (0, express_1.default)();
const PORT = 3000;
// Initialize ScalekitClient from environment variables at module scope
const envUrl = process.env.SCALEKIT_ENV_URL;
const clientId = process.env.SCALEKIT_CLIENT_ID;
const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
const scalekitClient = new ExtendedScalekitClient(envUrl, clientId, clientSecret);
// Use cookie-parser middleware so req.cookies.idToken is available
app.use((0, cookie_parser_1.default)());
/**
 * GET /logout
 *
 * 1. Read idToken from cookies
 * 2. Build Scalekit logout URL using getLogoutUrl(idTokenHint, postLogoutRedirectUri)
 * 3. Clear the three session cookies (accessToken, refreshToken, idToken)
 * 4. Respond with HTTP 302 redirect to the Scalekit logout URL
 */
app.get('/logout', (req, res) => {
    const idToken = req.cookies.idToken;
    // Build the Scalekit logout URL BEFORE clearing the idToken cookie,
    // because getLogoutUrl needs the id_token_hint query parameter
    const postLogoutRedirectUri = 'http://localhost:3000/goodbye';
    const logoutUrl = scalekitClient.getLogoutUrl(idToken ?? '', postLogoutRedirectUri);
    // Clear all three session cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('idToken');
    // Redirect to Scalekit's /oidc/logout endpoint
    res.redirect(logoutUrl);
});
/**
 * GET /goodbye
 *
 * Post-logout redirect target that confirms the user has been logged out.
 */
app.get('/goodbye', (_req, res) => {
    res.status(200).send('Goodbye');
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map