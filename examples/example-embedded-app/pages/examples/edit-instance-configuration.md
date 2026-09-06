## Edit Instance Configuration

Enable customers to reconfigure an instance they've already deployed — rotate credentials, swap an endpoint, tweak a config variable — without leaving your app. Rendered with `editInstanceConfiguration()`, which takes an `instanceId`, embeds the wizard inline in the element you pick, and fires `onSuccess`, `onCancel`, and `onDelete` callbacks so you control the surrounding UI.

This example pulls the customer's instances with `prismatic.graphqlRequest()`, opens the selected one in a dialog, and sets `triggerDetailsConfiguration: "hidden"` to keep trigger URLs out of view.

Configuration wizard options: [Configuration Wizard Customization](https://prismatic.io/docs/embed/marketplace/#configuration-wizard-customization). Background on instances: [Instances](https://prismatic.io/docs/instances/).
