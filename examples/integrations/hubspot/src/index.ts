import { componentManifests, integration } from "@prismatic-io/spectral";
import documentation from "../documentation.md";
import { integrationConfiguration } from "./configuration";
import flows from "./flows";

/** This integration calls HubSpot's API directly, so the registry is empty. */
export const componentRegistry = componentManifests({});

export { integrationConfiguration } from "./configuration";

export default integration({
  name: "HubSpot Contacts",
  description: "Creates and updates HubSpot contacts from your Acme contacts",
  category: "CRM",
  labels: ["headless", "example", "one-click"],
  iconPath: "icon.png",
  documentation,
  flows,
  configuration: integrationConfiguration,
  componentRegistry,
});
