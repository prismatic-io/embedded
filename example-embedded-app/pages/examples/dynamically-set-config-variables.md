## Dynamically Set Config Variables

Pre-fill the values you already know — API keys, endpoints, per-tenant settings — so your customers only fill in what's unique to them. Your app listens for an `INSTANCE_CONFIGURATION_LOADED` browser event from the configuration wizard and sets config variables programmatically.

This example matches on the **Setting Config Variables Example** integration, sets `API Key` and `HTTP Endpoint` automatically, and leaves `Third-party Credentials` for the customer.

**Setup:** Right-click and save [setting-config-variables-example.yml](/static/integrations/setting-config-variables-example.yml), [import it](https://prismatic.io/docs/integrations/low-code-integration-designer/#creating-a-new-integration), publish it, then [add it to your marketplace](https://prismatic.io/docs/instances/integration-marketplace/). Skipping the marketplace step shows a blank page.

Event list and options: [Dynamically setting config variables](https://prismatic.io/docs/embed/marketplace/#dynamically-setting-config-variables-in-marketplace).
