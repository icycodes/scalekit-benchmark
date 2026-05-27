const express = require("express");
const cookieParser = require("cookie-parser");
const { ScalekitClient } = require("@scalekit-sdk/node");

const app = express();
const PORT = 3000;

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

app.use(cookieParser());

const CALLBACK_URL = "http://localhost:3000/callback";
const POST_LOGOUT_URL = "http://localhost:3000/goodbye";

const decodeJwtPayload = (token) => {
  if (!token) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  const payload = parts[1];
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (error) {
    return null;
  }
};

const getAccessTokenFromRequest = (req) => {
  const authHeader = req.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return req.cookies.accessToken;
};

const validateAccessToken = async (req) => {
  const token = getAccessTokenFromRequest(req);
  if (!token) {
    return { valid: false, token: null };
  }
  try {
    const isValid = await scalekit.validateAccessToken(token);
    return { valid: Boolean(isValid), token };
  } catch (error) {
    return { valid: false, token };
  }
};

const requireAuthHtml = async (req, res, next) => {
  const { valid } = await validateAccessToken(req);
  if (!valid) {
    return res.redirect(302, "/login");
  }
  return next();
};

const requireAuthJson = async (req, res, next) => {
  const { valid } = await validateAccessToken(req);
  if (!valid) {
    return res.status(401).json({ error: "Access token is missing or invalid." });
  }
  return next();
};

app.get("/", (req, res) => {
  res.status(200).send(`
    <html>
      <head><title>Scalekit SaaSKit Demo</title></head>
      <body>
        <h1>Welcome to the Scalekit SaaSKit Demo</h1>
        <p><a href="/login">Sign in</a></p>
      </body>
    </html>
  `);
});

app.get("/login", async (req, res) => {
  const authorizationUrl = await scalekit.getAuthorizationUrl({
    redirectUri: CALLBACK_URL,
    scopes: ["openid", "profile", "email", "offline_access"],
  });
  res.redirect(302, authorizationUrl);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== "string") {
    return res.status(400).send("Missing authorization code.");
  }

  try {
    const tokens = await scalekit.authenticateWithCode({
      code,
      redirectUri: CALLBACK_URL,
    });

    res.cookie("accessToken", tokens.accessToken, { httpOnly: true });
    res.cookie("refreshToken", tokens.refreshToken, { httpOnly: true });
    res.cookie("idToken", tokens.idToken, { httpOnly: true });

    return res.redirect(302, "/dashboard");
  } catch (error) {
    return res.status(500).send("Authentication failed.");
  }
});

app.get("/dashboard", requireAuthHtml, (req, res) => {
  const idToken = req.cookies.idToken;
  const payload = decodeJwtPayload(idToken) || {};
  const email = payload.email || "Unknown";
  const sub = payload.sub || "Unknown";

  res.status(200).send(`
    <html>
      <head><title>Dashboard</title></head>
      <body>
        <h1>Dashboard</h1>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>User ID:</strong> ${sub}</p>
        <p><a href="/logout">Sign out</a></p>
        <script>
          fetch('/api/me', { credentials: 'include' })
            .then(response => response.json())
            .then(data => {
              const container = document.createElement('pre');
              container.textContent = JSON.stringify(data, null, 2);
              document.body.appendChild(container);
            })
            .catch(() => {
              const container = document.createElement('p');
              container.textContent = 'Failed to load profile data.';
              document.body.appendChild(container);
            });
        </script>
      </body>
    </html>
  `);
});

app.get("/api/me", requireAuthJson, (req, res) => {
  const idToken = req.cookies.idToken;
  const payload = decodeJwtPayload(idToken) || {};

  res.status(200).json({
    email: payload.email || null,
    sub: payload.sub || null,
  });
});

app.get("/logout", (req, res) => {
  const idToken = req.cookies.idToken;
  const logoutUrl = scalekit.getLogoutUrl(idToken, POST_LOGOUT_URL);

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.clearCookie("idToken");

  res.redirect(302, logoutUrl);
});

app.get("/goodbye", (req, res) => {
  res.status(200).send(`
    <html>
      <head><title>Signed Out</title></head>
      <body>
        <h1>You have signed out</h1>
        <p>Goodbye! You are now logged out.</p>
        <p><a href="/">Return to home</a></p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
