## Dynamically Set Config Variables

Sometimes, you know values for config variables that your customers do not (things like API keys or settings for your app).
In those cases, you may want to [dynamically set values for config variables](https://prismatic.io/docs/embedding-marketplace/#dynamically-setting-config-variables-in-marketplace) on behalf of your customer.

You can do that by listening for browser events from the configuration wizard.
In this example, we listen for an `INSTANCE_CONFIGURATION_LOADED` event, check if the integration that was loaded is called **Setting Config Variables Example**, and if so, we set the `API Key` and `HTTP Endpoint` config variables for our user, so they don't have to.
We leave the `Third-party Credentials` connection for the user to fill in.

### Setting up

To test setting config variables dynamically, you'll need to import the **Setting Config Variables Example** integration and add it to your integration marketplace.

1. Right-click and save this integration YAML definition: [setting-config-variables-example.yml](/static/integrations/setting-config-variables-example.yml)
2. [Import](https://prismatic.io/docs/integrations/#importing-an-integration) the integration into your Prismatic tenant.
3. Publish the integration, and [add it to your integration marketplace](https://prismatic.io/docs/integration-marketplace/).
   You may see a blank white page if you do forget to add your integration to the integration marketplace.

Then, click the button below to deploy an instance of the integration.
Note that some config variables were set automatically for you by this parent web app.

You can edit this page by modifying `pages/examples/dynamically-set-conifig-variables.tsx`.
