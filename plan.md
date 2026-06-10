# Scalekit — Research Plan for Evaluation Dataset

> Audience: dataset authors creating evaluation tasks for LLM coding agents.
> Scope: **AgentKit** and **SaaSKit** capabilities that can be exercised **end-to-end locally** using the preconfigured Scalekit dashboard fixtures below.

## 1. Library Overview

**Description.** Scalekit ([scalekit.com](https://scalekit.com)) is a developer platform that bundles two complementary auth products into a single SDK:

* **AgentKit** — give AI agents authenticated, scoped, per-user access to 100+ third-party SaaS apps (Gmail, Slack, GitHub, Salesforce, Notion, etc.) via OAuth/API-key/JWT "connectors". Scalekit stores tokens, exposes pre-built or proxy "tools", and can publish per-user MCP server URLs.
* **SaaSKit (aka Full-Stack Auth / FSA)** — drop-in hosted login pages with sessions, RBAC (roles & permissions), social logins, magic links / email OTP, organizations, and Enterprise SSO via SAML/OIDC. Returns an `id_token` + `access_token` + `refresh_token` to your callback URL.

**Ecosystem role.**

* Replaces the auth and "agent-to-SaaS" plumbing that teams used to roll out of Auth0, Clerk, WorkOS, Stytch, Composio/Arcade, and Pipedream Connect.
* Framework-agnostic SDKs: Node.js, Python, Go, Java. Native adapters for LangChain, Google ADK, Vercel AI SDK, Anthropic, OpenAI Agents, Mastra, CrewAI. Any MCP-compatible client (Claude Desktop, Cursor, Cline…) can consume a Scalekit-generated MCP URL.

**Project setup (testable locally with the provided fixtures).**

```bash
# Node.js
npm install @scalekit-sdk/node dotenv express cookie-parser

# Python
pip install scalekit-sdk-python python-dotenv flask requests
```

```bash
# .env
SCALEKIT_CLIENT_ID=<from dashboard>
SCALEKIT_CLIENT_SECRET=<from dashboard>
SCALEKIT_ENV_URL=<from dashboard>     # also referenced as SCALEKIT_ENVIRONMENT_URL
GITHUB_CONNECTION_NAME=github-test
SLACK_CONNECTION_NAME=slack-test
```

Initialize the client:

```ts
import { ScalekitClient } from '@scalekit-sdk/node';
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL!,
  process.env.SCALEKIT_CLIENT_ID!,
  process.env.SCALEKIT_CLIENT_SECRET!,
);
```

```python
from scalekit import ScalekitClient
scalekit = ScalekitClient(
    env_url=os.environ["SCALEKIT_ENV_URL"],
    client_id=os.environ["SCALEKIT_CLIENT_ID"],
    client_secret=os.environ["SCALEKIT_CLIENT_SECRET"],
)
```

---

## 2. Dashboard Integration (provided test fixtures — include verbatim)

```md
# Integration

## Envs

These environment variables will be provided:

* SCALEKIT_CLIENT_ID
* SCALEKIT_CLIENT_SECRET
* SCALEKIT_ENV_URL

## AgentKit

**NOTE**: The following values should be hardcoded, no environment variables will be provided.
NEVER introduce unprovided environment variable names.

Two connections are set up for testing:

1. GitHub
  * Connection Name: github-test
2. Slack
  * Connection Name: slack-test

Two connected accounts are set up for testing:

1.
  * Connection Name: github-test
  * Identifier: zealt-user01
2.
  * Connection Name: slack-test
  * Identifier: zealt-user01

## SaaSKit

**NOTE**: The following values should be hardcoded, no environment variables will be provided.
NEVER introduce unprovided environment variable names.

### Authentication configuration:

* Allowed callback URLs: After successful authentication, your app receives a callback at this URL to handle token exchange.
  * http://localhost:3000/callback
* Initiate-login URL: An endpoint in your app that redirects to Scalekit's `/authorize` endpoint. This is required to handle scenarios where login is not initiated from your app.
  * http://localhost:3000/login
* Post-logout URLs: After a user logs out, they are redirected here.
  * http://localhost:3000/goodbye

### Test User

Test Users is enabled. Matching identities can use the static OTP, and no verification email is sent.

* Test User Emails: 
  * zealt-user01+sktest@test.com
* Static OTP: Fixed 6-digit code for verifying test users.
  * 424242

### Enterprise SSO

This test organization comes with a preconfigured OIDC SSO connection using Scalekit's IdP Simulator. You can use it to test SSO workflows.

Name: Test Organization

Organization Domains:
* example.com
* example.org

These domains are used for Home Realm Discovery. When a user's email domain matches one of these, they are automatically redirected to the organization's SSO connection to authenticate.

```

**What this enables locally.**

| Fixture | Enables local testing of |
|---|---|
| `github-test`, `slack-test` connections + pre-active connected accounts for `zealt-user01` | `list_scoped_tools` / `execute_tool` calls, listing/deleting connected accounts, generating reauth links, MCP server configs |
| `http://localhost:3000/callback` allow-listed | SaaSKit OAuth code exchange via `authenticateWithCode` |
| `http://localhost:3000/login` initiate-login URL | IdP-initiated SSO and invitation flows |
| `http://localhost:3000/goodbye` post-logout URL | `/oidc/logout` with `post_logout_redirect_uri` |
| Test user `zealt-user01+sktest@test.com` + OTP `424242` | Headless E2E sign-in via magic link / email OTP without a real inbox |
| `example.com` / `example.org` mapped to IdP simulator | Enterprise SSO + Home Realm Discovery without configuring a real Okta/Azure tenant |

---

## 3. AgentKit — Core Primitives & APIs

Docs index: <https://docs.scalekit.com/llms.txt> · AgentKit overview: <https://docs.scalekit.com/agentkit/overview.md> · Quickstart: <https://docs.scalekit.com/agentkit/quickstart.md>

### 3.1 Connections, Connected Accounts, Connector states

A **connection** (configured in the dashboard) supplies provider credentials. A **connected account** is the per-user `(connection, identifier)` record that stores OAuth tokens.

States: `PENDING`, `ACTIVE`, `EXPIRED`, `REVOKED`, `ERROR`.

```python
# Idempotent — use as the default when a user might be connecting for the first time.
resp = scalekit.actions.get_or_create_connected_account(
    connection_name="github-test",
    identifier="zealt-user01",
)
print(resp.connected_account.status)  # ACTIVE for the provided fixtures
```

```ts
const resp = await scalekit.actions.getOrCreateConnectedAccount({
  connectionName: 'slack-test',
  identifier: 'zealt-user01',
});
```

If status is not `ACTIVE`, generate an authorization link (Scalekit's **hosted page** auto-picks OAuth consent vs. credential form per connector type):

```python
link = scalekit.actions.get_authorization_link(
    connection_name="github-test",
    identifier="zealt-user01",
)
print(link.link)  # redirect / email this to the user
```

Docs: <https://docs.scalekit.com/agentkit/connected-accounts.md>

### 3.2 Tool calling (Scalekit-optimized built-in tools)

* `list_scoped_tools(identifier, filter, page_size)` — returns the JSON-Schema tool defs for that user. Pass straight into your LLM.
* `execute_tool({ tool_name, identifier | connected_account_id, tool_input })` — Scalekit injects creds and proxies the API call.

```ts
const { tools } = await scalekit.tools.listScopedTools('zealt-user01', {
  filter: { connectionNames: ['github-test'] },
  pageSize: 100,
});

const result = await scalekit.actions.executeTool({
  toolName: 'github_list_repos_for_authenticated_user',
  identifier: 'zealt-user01',
  connector: 'github-test',
  toolInput: { per_page: 5 },
});
```

Docs: <https://docs.scalekit.com/agentkit/tools/scalekit-optimized-tools.md> · Tool metadata schema: <https://docs.scalekit.com/agentkit/tools/overview.md>

### 3.3 Proxy & custom tools

If an endpoint isn't covered by an optimized tool, use **proxy tools** to call any provider URL through Scalekit's auth:

```python
resp = scalekit.actions.execute_tool(
    tool_name="github_proxy_api_call",  # name varies; see proxy docs
    identifier="zealt-user01",
    tool_input={
        "method": "GET",
        "path": "/user/starred",
    },
)
```

Docs: <https://docs.scalekit.com/agentkit/tools/proxy-tools.md> · <https://docs.scalekit.com/agentkit/tools/custom-tools.md>

### 3.4 Pre- and post-execution processors (modifiers)

Wrap tools with deterministic guard-rails — e.g., always force `is:unread` on a Gmail fetch, or trim the response to a few fields before returning to the LLM.

Docs: <https://docs.scalekit.com/agentkit/tools/custom-processors.md>

### 3.5 Per-user MCP servers

* `actions.mcp.create_config(name, connection_tool_mappings=[...])` — one-time, declares which connections/tools the MCP server exposes.
* `actions.mcp.ensure_instance(config_name, identifier)` — per-user, returns a pre-authenticated MCP URL Scalekit hosts.

```python
cfg = scalekit.actions.mcp.create_config(
    name="github-slack-agent",
    description="Demo MCP server",
    connection_tool_mappings=[
        McpConfigConnectionToolMapping(connection_name="github-test"),
        McpConfigConnectionToolMapping(connection_name="slack-test",
                                       tools=["slack_post_message"]),
    ],
)
mcp_url = scalekit.actions.mcp.ensure_instance(
    config_name=cfg.config.name, identifier="zealt-user01"
).instance.mcp_url
```

The URL can be handed to any MCP client. Docs: <https://docs.scalekit.com/agentkit/mcp/configure-mcp-server.md> · <https://docs.scalekit.com/agentkit/mcp/generate-user-urls.md>

### 3.6 User verification (OAuth identity binding)

Production safeguard: when the user finishes OAuth, Scalekit redirects to your `user_verify_url`. Your server validates `state`, reads the logged-in user from its own session, then calls `verify_connected_account_user(auth_request_id, identifier)`. For local testing the dashboard offers a **"Scalekit users only"** mode so no verify route is required.

Docs: <https://docs.scalekit.com/agentkit/user-verification.md>

### 3.7 Framework adapters

Native Python adapters return framework-typed tool objects (no schema reshaping):

```python
tools = scalekit.actions.langchain.get_tools(identifier="zealt-user01",
                                             connection_names=["github-test"])
# or
tools = scalekit.actions.google.get_tools(identifier="zealt-user01",
                                          connection_names=["github-test"])
```

Vercel AI SDK, OpenAI Agents, Anthropic, Mastra, CrewAI, Claude Managed Agents are all documented in <https://docs.scalekit.com/agentkit/examples.md>.

---

## 4. SaaSKit — Core Primitives & APIs

Quickstart: <https://docs.scalekit.com/authenticate/fsa/quickstart/>

### 4.1 Authorization URL & callback

```ts
const authorizationUrl = scalekit.getAuthorizationUrl(
  'http://localhost:3000/callback',
  { scopes: ['openid', 'profile', 'email', 'offline_access'] },
);
res.redirect(authorizationUrl);
```

### 4.2 Code exchange

```ts
app.get('/callback', async (req, res) => {
  const { user, idToken, accessToken, refreshToken, expiresIn } =
    await scalekit.authenticateWithCode(req.query.code as string,
                                        'http://localhost:3000/callback');
  // set HttpOnly cookies, redirect to /dashboard
});
```

Decoded `id_token` claims include `sub`, `oid` (organization id), `email`, `name`. The `access_token` adds `roles`, `permissions` for RBAC.

### 4.3 Sessions & token validation

```ts
const isValid = await scalekit.validateAccessToken(token);
```

`offline_access` scope grants a refresh token to swap for new access tokens.

### 4.4 Logout

```ts
const logoutUrl = scalekit.getLogoutUrl(idToken, 'http://localhost:3000/goodbye');
res.clearCookie('accessToken'); res.clearCookie('refreshToken'); res.clearCookie('idToken');
res.redirect(logoutUrl); // /oidc/logout requires a real browser redirect, not fetch()
```

Docs: <https://docs.scalekit.com/authenticate/fsa/logout/>

### 4.5 Auth methods (passwordless)

The provided test user `zealt-user01+sktest@test.com` + static OTP `424242` lets agents drive the hosted login page without a real inbox. Magic Link & OTP configuration: <https://docs.scalekit.com/authenticate/auth-methods/passwordless/>

### 4.6 Organizations & users

```ts
const { organization } = await scalekit.organization.createOrganization('Orion Analytics');
await scalekit.organization.updateOrganizationSettings(orgId, {
  features: [{ name: 'sso', enabled: true }],
});
```

Docs: <https://docs.scalekit.com/authenticate/manage-users-orgs/create-organization/>

### 4.7 Enterprise SSO with the IdP Simulator

The fixture organization owns domains `example.com` / `example.org`. Any sign-in attempt with one of those domains triggers **Home Realm Discovery** and routes to Scalekit's hosted IdP simulator — no real Okta/Azure tenant needed.

Docs: <https://docs.scalekit.com/authenticate/auth-methods/enterprise-sso/>

### 4.8 RBAC (roles & permissions)

`access_token` carries `roles: ["admin", "member"]` and `permissions: ["projects:read", "projects:create"]`. Enforce via middleware:

```ts
function requirePermission(p) {
  return (req, res, next) =>
    req.user.permissions.includes(p) ? next() : res.status(403).end();
}
app.get('/api/projects', validateAndExtractAuth,
                          requirePermission('projects:read'), handler);
```

Docs: <https://docs.scalekit.com/authenticate/authz/implement-access-control/>

---

## 5. Real-World Use Cases & Templates

* **Full-stack Express + EJS auth demo** — <https://github.com/scalekit-inc/nodejs-example-apps/tree/main/expressjs-loginbox-authn>
* **Next.js full-stack auth** — <https://github.com/scalekit-inc/nextjs-example-apps/tree/main/full-stack-auth>
* **AgentKit + MCP Python demos** — <https://github.com/scalekit-inc/python-connect-demos>
* **Framework integration examples (LangChain / OpenAI / Anthropic / Mastra / Google ADK / Vercel AI / CrewAI)** — <https://docs.scalekit.com/agentkit/examples.md>
* **Code samples by language** — <https://docs.scalekit.com/resources/code-samples/>

Common integration patterns surfaced in the docs:

1. **B2B SaaS bootstrap** — SaaSKit login → org auto-created → admin enables SSO → users in matching domain auto-routed to SSO.
2. **Agent-on-behalf-of-user** — SaaSKit login → AgentKit `get_or_create_connected_account` for the logged-in user → tool call.
3. **MCP-ready agent** — declare config once → `ensure_instance` per user → hand URL to Claude Desktop / Cursor.
4. **RBAC-gated API** — extract roles/permissions from `access_token` JWT → guard routes per `resource:action` permission.

---

## 6. Developer Friction Points

(These make especially good evaluation tasks because there is one *narrow correct path*.)

1. **`connection_name` is workspace-specific and case-sensitive** — must match the dashboard exactly, is *not* always the provider slug. Hard-coding `"gmail"` instead of the dashboard's `MY_GMAIL` is the most common quickstart failure. Source: troubleshooting in <https://docs.scalekit.com/agentkit/tools/scalekit-optimized-tools.md>.
2. **Logout must be a browser redirect, not `fetch()`** — `/oidc/logout` relies on Scalekit's HttpOnly session cookie. API-style POSTs silently fail. Source: <https://docs.scalekit.com/authenticate/fsa/logout/> "Why must logout be a browser redirect?".
3. **Clear cookies *after* generating the logout URL** — the ID token is needed as `id_token_hint`. Same doc.
4. **Redirect URL exact-match** — protocol/host/port/path must match `Allowed callback URLs`. A mismatch like `http://127.0.0.1:3000/callback` vs. `http://localhost:3000/callback` is rejected. Quickstart "Match your redirect URLs exactly" callout.
5. **`list_scoped_tools` default page size hides tools** — large connectors (Gmail, GitHub) need `page_size=100` or pagination, otherwise the agent silently can't see them. Source: optimized-tools doc.
6. **User verification mode** — "Scalekit users only" is fine for testing but must be flipped to "Custom user verifier" before production; otherwise any link can be redeemed by a different user.
7. **Authorization data must be validated server-side** — never trust roles/permissions parsed client-side; always call `validateAccessToken` first.

---

## 7. Evaluation Ideas (brief, high-level)

Tasks below are sized roughly easy → hard. All are runnable with only the provided env vars, the two preconfigured connections, the localhost callbacks, and the test user / static OTP / IdP simulator.

**AgentKit**

1. Initialize the SDK, call `get_or_create_connected_account` for the GitHub fixture, and assert the returned status is `ACTIVE`.
2. List the tools scoped to `zealt-user01` for the `github-test` connection and print every tool name with `page_size=100`.
3. Execute a single GitHub tool (e.g., list repos) for `zealt-user01` and pretty-print the structured response.
4. Build a minimal LLM-driven loop: fetch scoped tools for both `github-test` and `slack-test`, hand them to a model, execute the chosen tool, and feed the result back.
5. Generate an authorization link for a brand-new identifier (e.g., `zealt-user02`) and verify the returned link points to a Scalekit hosted page; also assert the new account starts in `PENDING`.
6. Create an MCP config exposing a whitelist of two tools across `github-test` + `slack-test`, then call `ensure_instance` to get a per-user MCP URL.
7. Add a post-execution modifier that trims a GitHub repo-list response to `[name, html_url]` before returning it to the agent.

**SaaSKit**

8. Implement a `/login` route that calls `getAuthorizationUrl` with `openid profile email offline_access` and redirects to Scalekit.
9. Implement `/callback` to exchange the code via `authenticateWithCode`, set HttpOnly cookies, and redirect to `/dashboard`.
10. Implement `/logout` that produces the Scalekit logout URL, clears cookies in the correct order, and redirects to `http://localhost:3000/goodbye`.
11. End-to-end sign-in test using the test-user email + static OTP `424242`, asserting an `id_token` with `oid` and `sub` is issued.
12. Trigger Enterprise SSO via Home Realm Discovery by signing in as `alice@example.com`; assert the IdP simulator is invoked.
13. Build an RBAC middleware that validates the access token with `validateAccessToken` and gates a `/api/projects` route on the `projects:read` permission.
14. Combine both kits: after a SaaSKit login, use the authenticated user's `sub` (or the fixed identifier `zealt-user01`) as the AgentKit `identifier` to execute a tool from the logged-in session.

---

## 8. Sources

1. <https://docs.scalekit.com/llms.txt> — master routing index for all Scalekit docs.
2. <https://docs.scalekit.com/agentkit/overview.md> — AgentKit conceptual model (connections, connected accounts, tools).
3. <https://docs.scalekit.com/agentkit/quickstart.md> — End-to-end agent example with `get_or_create_connected_account` → `get_authorization_link` → `execute_tool`.
4. <https://docs.scalekit.com/agentkit/connected-accounts.md> — Account states, list/delete, scope updates.
5. <https://docs.scalekit.com/agentkit/tools/overview.md> — Tool metadata schema and best practices.
6. <https://docs.scalekit.com/agentkit/tools/scalekit-optimized-tools.md> — `list_scoped_tools`, `execute_tool`, framework adapters, troubleshooting.
7. <https://docs.scalekit.com/agentkit/user-verification.md> — OAuth user-identity binding flow and modes.
8. <https://docs.scalekit.com/agentkit/mcp/configure-mcp-server.md> — MCP config templates, per-user instances.
9. <https://docs.scalekit.com/agentkit/examples.md> — All framework integration examples.
10. <https://docs.scalekit.com/authenticate/fsa/quickstart/> — SaaSKit Node/Python/Go/Java quickstart with authorize URL, callback, sessions, logout.
11. <https://docs.scalekit.com/authenticate/fsa/logout/> — Logout endpoint design, common pitfalls, session layers.
12. <https://docs.scalekit.com/authenticate/auth-methods/passwordless/> — Magic link / Email OTP configuration.
13. <https://docs.scalekit.com/authenticate/auth-methods/enterprise-sso/> — SSO activation, Home Realm Discovery, IdP simulator testing.
14. <https://docs.scalekit.com/authenticate/manage-users-orgs/create-organization/> — Organizations: auto-creation on signup and SDK `createOrganization`.
15. <https://docs.scalekit.com/authenticate/authz/implement-access-control/> — RBAC patterns, `validateAccessToken`, role/permission middleware.
16. <https://docs.scalekit.com/_llms-txt/saaskit-complete.txt> — Bundled SaaSKit reference (RBAC, sessions, SCIM).
17. <https://github.com/scalekit-inc/nodejs-example-apps> · <https://github.com/scalekit-inc/nextjs-example-apps> · <https://github.com/scalekit-inc/python-connect-demos> — Official starter templates.
