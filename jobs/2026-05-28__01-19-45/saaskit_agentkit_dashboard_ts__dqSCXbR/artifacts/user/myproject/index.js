const express = require("express");
const cookieParser = require("cookie-parser");
const { ScalekitClient } = require("@scalekit-sdk/node");

const PORT = 3000;
const CALLBACK_URL = "http://localhost:3000/callback";
const POST_LOGOUT_REDIRECT = "http://localhost:3000/goodbye";
const GITHUB_CONNECTION = "github-test";
const GITHUB_IDENTIFIER = "zealt-user01";

const requiredEnv = [
  "SCALEKIT_ENV_URL",
  "SCALEKIT_CLIENT_ID",
  "SCALEKIT_CLIENT_SECRET",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const authClient = scalekit.saaskit || scalekit;
const agentClient = scalekit.agentkit || scalekit;

const app = express();
app.use(cookieParser());

const decodeJwtPayload = (token) => {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (error) {
    return null;
  }
};

const renderPage = (title, body) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; }
      .repo-list { margin-top: 16px; }
      .repo-item { margin-bottom: 8px; }
      .btn { display: inline-block; padding: 8px 14px; background: #111827; color: #fff; text-decoration: none; border-radius: 4px; }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;

const buildAuthorizationUrl = (scopes) => {
  try {
    return authClient.getAuthorizationUrl({
      redirectUri: CALLBACK_URL,
      scope: scopes,
    });
  } catch (error) {
    return authClient.getAuthorizationUrl(CALLBACK_URL, scopes);
  }
};

const authenticateWithCode = async (code) => {
  try {
    return await authClient.authenticateWithCode(code, CALLBACK_URL);
  } catch (error) {
    return await authClient.authenticateWithCode({
      code,
      redirectUri: CALLBACK_URL,
    });
  }
};

const buildLogoutUrl = (idToken) => {
  try {
    return authClient.getLogoutUrl(idToken, POST_LOGOUT_REDIRECT);
  } catch (error) {
    return authClient.getLogoutUrl({
      idTokenHint: idToken,
      postLogoutRedirectUri: POST_LOGOUT_REDIRECT,
    });
  }
};

app.get("/", (req, res) => {
  const body = `
    <h1>Welcome</h1>
    <p>Sign in to view your GitHub repositories.</p>
    <a class="btn" href="/login">Sign in</a>
  `;
  res.status(200).send(renderPage("Welcome", body));
});

app.get("/login", (req, res) => {
  const scopes = ["openid", "profile", "email", "offline_access"].join(" ");
  const authorizationUrl = buildAuthorizationUrl(scopes);
  res.redirect(302, authorizationUrl);
});

app.get("/callback", async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      res.status(400).send(renderPage("Missing code", "<p>Missing code.</p>"));
      return;
    }

    const session = await authenticateWithCode(code);

    res.cookie("accessToken", session.accessToken, {
      httpOnly: true,
      sameSite: "lax",
    });
    res.cookie("refreshToken", session.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
    });
    res.cookie("idToken", session.idToken, {
      httpOnly: true,
      sameSite: "lax",
    });

    res.redirect(302, "/dashboard");
  } catch (error) {
    next(error);
  }
});

const findRepoToolName = (tools) => {
  if (!Array.isArray(tools)) {
    return null;
  }

  const lowerMatch = tools.find((tool) => {
    const name = (tool.name || "").toLowerCase();
    const description = (tool.description || "").toLowerCase();
    return (
      (name.includes("repo") && name.includes("list")) ||
      (description.includes("repository") && description.includes("list"))
    );
  });

  return lowerMatch ? lowerMatch.name : null;
};

const extractRepositories = (result) => {
  if (!result || typeof result !== "object") {
    return [];
  }

  const possibleArrays = [
    result.repositories,
    result.items,
    result.data,
    result.data && result.data.repositories,
  ];

  const repoArray = possibleArrays.find((value) => Array.isArray(value));
  if (!repoArray) {
    return [];
  }

  return repoArray;
};

app.get("/dashboard", async (req, res, next) => {
  try {
    const idToken = req.cookies.idToken;
    if (!idToken) {
      res.redirect(302, "/login");
      return;
    }

    const payload = decodeJwtPayload(idToken);
    const email = payload && payload.email ? payload.email : "Unknown";

    const toolsResponse = await agentClient.listScopedTools({
      connection: GITHUB_CONNECTION,
      identifier: GITHUB_IDENTIFIER,
      pageSize: 100,
    });

    const toolName = findRepoToolName(toolsResponse.tools || toolsResponse);
    if (!toolName) {
      res.status(500).send(
        renderPage(
          "Missing tool",
          "<p>Unable to locate GitHub repository tool.</p>"
        )
      );
      return;
    }

    const toolResult = await agentClient.executeTool({
      connection: GITHUB_CONNECTION,
      identifier: GITHUB_IDENTIFIER,
      tool: toolName,
      params: {},
    });

    const repositories = extractRepositories(toolResult);
    const repoItems = repositories.length
      ? repositories
          .slice(0, 10)
          .map((repo) => {
            const label = repo.full_name || repo.html_url || "Unknown repo";
            return `<li class="repo-item">${label}</li>`;
          })
          .join("")
      : "<li class=\"repo-item\">No repositories returned.</li>";

    const body = `
      <h1>Dashboard</h1>
      <p>Signed in as <strong>${email}</strong></p>
      <h2>GitHub Repositories</h2>
      <ul class="repo-list">
        ${repoItems}
      </ul>
      <a class="btn" href="/logout">Sign out</a>
    `;

    res.status(200).send(renderPage("Dashboard", body));
  } catch (error) {
    next(error);
  }
});

app.get("/logout", (req, res) => {
  const idToken = req.cookies.idToken;
  const logoutUrl = buildLogoutUrl(idToken);

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.clearCookie("idToken");

  res.redirect(302, logoutUrl);
});

app.get("/goodbye", (req, res) => {
  const body = `
    <h1>Goodbye</h1>
    <p>You have been signed out.</p>
    <a class="btn" href="/">Return home</a>
  `;
  res.status(200).send(renderPage("Goodbye", body));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(renderPage("Error", "<p>Something went wrong.</p>"));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
