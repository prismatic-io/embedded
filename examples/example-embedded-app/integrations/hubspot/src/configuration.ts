import { configuration, customerActivatedConnection } from "@prismatic-io/spectral";
import { z } from "zod";

/**
 * The shape of the values an instance saves. HubSpot needs nothing from the
 * customer but a connection, so there are no fields. The example app deploys
 * the integration as soon as the customer connects HubSpot.
 */
export const configurationSchema = z.object({});

export type Configuration = z.infer<typeof configurationSchema>;

/**
 * Names this shape of the configuration. Change it when the schema changes in a
 * way saved values can't satisfy, so `init` can tell which shape a saved value is in.
 * Version 1 saved a lifecycle stage, which this version no longer has.
 */
export const CONFIGURATION_VERSION = "hubspot-v2";

/**
 * The customer's HubSpot account. It's a customer-activated connection: your
 * organization defines it once in Prismatic, with your HubSpot OAuth app, and
 * each customer authorizes their own HubSpot account. The stable key must match
 * the one you give that connection in Prismatic.
 */
export const hubspotConnection = customerActivatedConnection({ stableKey: "hubspot-oauth" });

export const integrationConfiguration = configuration({
  instance: {
    schema: configurationSchema,
    version: CONFIGURATION_VERSION,
    connections: { hubspot: hubspotConnection },
  },
  init: {
    /** There's nothing to choose, so the configuration is always complete. */
    perform: async () => ({ configuration: {} }),
  },
});

/**
 * Types `context.configuration` and `context.connections` in flow contexts
 * from the configuration above.
 */
declare module "@prismatic-io/spectral" {
  interface IntegrationDefinitionConfiguration extends TIntegrationConfiguration {}
}

type TIntegrationConfiguration = typeof integrationConfiguration;
