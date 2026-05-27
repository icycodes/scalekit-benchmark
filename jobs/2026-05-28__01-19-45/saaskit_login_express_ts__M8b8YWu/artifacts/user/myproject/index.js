const express = require("express");
const cookieParser = require("cookie-parser");
const { ScalekitClient } = require("@scalekit-sdk/node");

const app = express();

const requiredEnvVars = [
  "SCALEKIT_ENV_URL",
  "SCALEKIT_CLIENT_ID",
  "SCALEKIT_CLIENT_SECRET"
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

app.use(cookieParser());

const redirectUri = "http://localhost:3000/callback";
const logoutRedirectUri = "http://localhost:3000/goodbye";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/"
};

const clearCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/"
};

const decodeJwtPayload = (token) => {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid JWT format");
  }
  const payload = parts[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const paddedPayload = payload.padEnd(
    payload.length + ((4 - (payload.length % 4)) % 4),
    "="
  );
  const decoded = Buffer.from(paddedPayload, "base64").toString("utf8");
  return JSON.parse(decoded);
};

const landingPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Scalekit SaaSKit Demo</title>
  </head>
  <body>
    <h1>Welcome to the Scalekit SaaSKit Demo</h1>
    <p><a href="/login">Sign in with Scalekit</a></p>
  </body>
</html>`;

const goodbyePage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Signed out</title>
  </head>
  <body>
    <h1>Goodbye!</h1>
    <p>You have signed out successfully.</p>
    <p><a href="/">Return to home</a></p>
  </body>
</html>`;

app.get("/", (req, res) => {
  res.status(200).type("html").send(landingPage);
});

app.get("/login", async (req, res, next) => {
  try {
    const authorizationUrl = await scalekit.getAuthorizationUrl(redirectUri, {
      scopes: ["openid", "profile", "email", "offline_access"]
    });
    res.redirect(302, authorizationUrl);
  } catch (error) {
    next(error);
  }
});

app.get("/callback", async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code || Array.isArray(code)) {
      res.status(400).send("Missing authorization code.");
      return;
    }

    const { accessToken, refreshToken, idToken } =
      await scalekit.authenticateWithCode(code, redirectUri);

    res.cookie("accessToken", accessToken, cookieOptions);
    res.cookie("refreshToken", refreshToken, cookieOptions);
    res.cookie("idToken", idToken, cookieOptions);

    res.redirect(302, "/dashboard");
  } catch (error) {
    next(error);
  }
});

app.get("/dashboard", (req, res) => {
  const { idToken } = req.cookies;
  if (!idToken) {
    res.redirect(302, "/login");
    return;
  }

  let email = "";
  try {
    const claims = decodeJwtPayload(idToken);
    email = claims.email || "";
  } catch (error) {
    res.redirect(302, "/login");
    return;
  }

  const dashboardPage = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Dashboard</title>
    </head>
    <body>
      <h1>Dashboard</h1>
      <p>Signed in as: <strong>${email}</strong></p>
      <p><a href="/logout">Sign out</a></p>
    </body>
  </html>`;

  res.status(200).type("html").send(dashboardPage);
});

app.get("/logout", async (req, res, next) => {
  try {
    const { idToken } = req.cookies;
    if (!idToken) {
      res.clearCookie("accessToken", clearCookieOptions);
      res.clearCookie("refreshToken", clearCookieOptions);
      res.clearCookie("idToken", clearCookieOptions);
      res.redirect(302, "/goodbye");
      return;
    }

    const logoutUrl = await scalekit.getLogoutUrl(idToken, logoutRedirectUri);

    res.clearCookie("accessToken", clearCookieOptions);
    res.clearCookie("refreshToken", clearCookieOptions);
    res.clearCookie("idToken", clearCookieOptions);

    res.redirect(302, logoutUrl);
  } catch (error) {
    next(error);
  }
});

app.get("/goodbye", (req, res) => {
  res.status(200).type("html").send(goodbyePage);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Unexpected error.");
});

app.listen(3000, () => {
  console.log("Scalekit demo app running on http://localhost:3000");
});
