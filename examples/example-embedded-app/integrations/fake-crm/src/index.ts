import { componentManifests, integration } from "@prismatic-io/spectral";
import documentation from "../documentation.md";
import { integrationConfiguration } from "./configuration";
import flows from "./flows";

/** This integration uses no other components, so the registry is empty. */
export const componentRegistry = componentManifests({});

export { integrationConfiguration } from "./configuration";

export default integration({
  name: "Fake CRM",
  description:
    "Syncs people from Fake CRM to Acme as contacts, using a field mapping your customer chooses",
  category: "CRM",
  labels: ["headless", "example"],
  iconPath: "icon.png",
  documentation,
  flows,
  configuration: integrationConfiguration,
  componentRegistry,
});
