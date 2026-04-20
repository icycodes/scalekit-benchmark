B2B SaaS platforms often need to programmatically provision tenants and configure SSO connections for specific domains when new customers onboard.

You need to write an asynchronous Node.js function `provisionTenant(tenantName, domain)` that uses the `@scalekit-sdk/node` client to programmatically create a new organization and configure a base SSO connection linked to the provided domain. 

**Constraints:**
- Use the `scalekit.organization` module methods to create the entity.
- The function MUST return a JSON object strictly containing `{ "organization_id": "...", "domain": "..." }`.
- Do NOT hardcode API credentials; assume the Scalekit client is passed in as a parameter `client` to the function.