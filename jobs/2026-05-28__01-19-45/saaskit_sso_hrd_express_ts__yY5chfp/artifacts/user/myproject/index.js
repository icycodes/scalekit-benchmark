const express = require("express");
const cookieParser = require("cookie-parser");
const { ScalekitClient } = require("@scalekit-sdk/node");

const app = express();
app.use(cookieParser());

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const redirectUri = "http://localhost:3000/callback";
const postLogoutRedirectUri = "http://localhost:3000/goodbye";

const decodeJwtPayload = (token) => {
  const payload = token.split(".")[1];
  if (!payload) {
    throw new Error("Invalid token payload");
  }
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json);
};

app.get("/", (req, res) => {
  res.type("html").send(`
    <html>
      <head><title>Scalekit SaaSKit Demo</title></head>
      <body>
        <h1>Welcome</h1>
        <p>Sign in to continue.</p>
        <a href="/login">Sign in with SSO</a>
      </body>
    </html>
  `);
});

app.get("/login", (req, res) => {
  const authorizationUrl = scalekit.getAuthorizationUrl(redirectUri, {
    scopes: ["openid", "profile", "email", "offline_access"],
  });
  res.redirect(authorizationUrl);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Missing authorization code.");
  }

  try {
    const authResponse = await scalekit.authenticateWithCode(code, redirectUri);

    res.cookie("accessToken", authResponse.accessToken, {
      httpOnly: true,
      sameSite: "lax",
    });
    res.cookie("refreshToken", authResponse.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
    });
    res.cookie("idToken", authResponse.idToken, {
      httpOnly: true,
      sameSite: "lax",
    });

    return res.redirect("/dashboard");
  } catch (error) {
    return res.status(500).send("Authentication failed.");
  }
});

app.get("/dashboard", (req, res) => {
  const { idToken } = req.cookies;
  if (!idToken) {
    return res.redirect("/login");
  }

  let payload;
  try {
    payload = decodeJwtPayload(idToken);
  } catch (error) {
    return res.redirect("/login");
  }

  const email = payload.email || "Unknown";
  const organizationId = payload.oid || "Unknown";

  res.type("html").send(`
    <html>
      <head><title>Dashboard</title></head>
      <body>
        <h1>Dashboard</h1>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Organization ID:</strong> ${organizationId}</p>
        <a href="/logout">Sign out</a>
      </body>
    </html>
  `);
});

app.get("/logout", (req, res) => {
  const { idToken } = req.cookies;
  const logoutUrl = scalekit.getLogoutUrl(idToken, postLogoutRedirectUri);

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.clearCookie("idToken");

  res.redirect(logoutUrl);
});

app.get("/goodbye", (req, res) => {
  res.type("html").send(`
    <html>
      <head><title>Goodbye</title></head>
      <body>
        <h1>You have signed out</h1>
        <p>Goodbye! Your session has ended.</p>
        <a href="/">Return to home</a>
      </body>
    </html>
  `);
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
