const express = require("express");
const cookieParser = require("cookie-parser");
const { ScalekitClient } = require("@scalekit-sdk/node");

const app = express();
app.use(cookieParser());

const PORT = 3000;
const REDIRECT_URI = "http://localhost:3000/callback";
const LOGOUT_REDIRECT_URI = "http://localhost:3000/goodbye";

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax"
};

const renderPage = (title, body) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; }
      .card { padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 640px; }
      a.button { display: inline-block; padding: 10px 16px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; margin-right: 8px; }
      .meta { margin-top: 16px; }
    </style>
  </head>
  <body>
    <div class="card">
      ${body}
    </div>
  </body>
</html>`;

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== "string") {
    return null;
  }
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  try {
    const payload = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
};

const clearSessionCookies = (res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.clearCookie("idToken");
};

app.get("/", (req, res) => {
  const body = `
    <h1>Welcome to Scalekit SaaSKit Demo</h1>
    <p>Sign in to access your dashboard.</p>
    <a class="button" href="/login">Sign in</a>
  `;
  res.status(200).send(renderPage("Welcome", body));
});

app.get("/login", (req, res) => {
  const url = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: ["openid", "profile", "email", "offline_access"]
  });
  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== "string") {
    return res.redirect("/login");
  }

  try {
    const authResult = await scalekit.authenticateWithCode(code, REDIRECT_URI);
    if (!authResult || !authResult.accessToken || !authResult.refreshToken || !authResult.idToken) {
      clearSessionCookies(res);
      return res.redirect("/login");
    }

    res.cookie("accessToken", authResult.accessToken, cookieOptions);
    res.cookie("refreshToken", authResult.refreshToken, cookieOptions);
    res.cookie("idToken", authResult.idToken, cookieOptions);
    return res.redirect("/dashboard");
  } catch (error) {
    clearSessionCookies(res);
    return res.redirect("/login");
  }
});

app.get("/dashboard", (req, res) => {
  const { accessToken, idToken } = req.cookies;
  if (!accessToken || !idToken) {
    return res.redirect("/login");
  }

  const accessPayload = decodeJwtPayload(accessToken) || {};
  const idPayload = decodeJwtPayload(idToken) || {};
  const email = idPayload.email || "unknown";
  const issuedAt = accessPayload.iat;
  const expiresAt = accessPayload.exp;

  const body = `
    <h1>Dashboard</h1>
    <p><strong>Email:</strong> ${email}</p>
    <div class="meta">
      <p><strong>iat:</strong> ${issuedAt}</p>
      <p><strong>exp:</strong> ${expiresAt}</p>
    </div>
    <div class="meta">
      <a class="button" href="/refresh-session">Refresh access token</a>
      <a class="button" href="/logout">Sign out</a>
    </div>
  `;

  res.status(200).send(renderPage("Dashboard", body));
});

app.get("/refresh-session", async (req, res) => {
  const { refreshToken, idToken } = req.cookies;
  if (!refreshToken) {
    return res.redirect("/login");
  }

  try {
    const refreshResult = await scalekit.refreshAccessToken(refreshToken);
    if (!refreshResult || !refreshResult.accessToken || !refreshResult.refreshToken) {
      clearSessionCookies(res);
      return res.redirect("/login");
    }

    res.cookie("accessToken", refreshResult.accessToken, cookieOptions);
    res.cookie("refreshToken", refreshResult.refreshToken, cookieOptions);

    if (refreshResult.idToken) {
      res.cookie("idToken", refreshResult.idToken, cookieOptions);
    } else if (idToken) {
      res.cookie("idToken", idToken, cookieOptions);
    }

    return res.redirect("/dashboard");
  } catch (error) {
    clearSessionCookies(res);
    return res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  const { idToken } = req.cookies;
  if (!idToken) {
    clearSessionCookies(res);
    return res.redirect("/goodbye");
  }

  const logoutUrl = scalekit.getLogoutUrl(idToken, LOGOUT_REDIRECT_URI);
  clearSessionCookies(res);
  return res.redirect(logoutUrl);
});

app.get("/goodbye", (req, res) => {
  const body = `
    <h1>Goodbye</h1>
    <p>You are now signed out.</p>
    <a class="button" href="/">Return home</a>
  `;
  res.status(200).send(renderPage("Signed out", body));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
