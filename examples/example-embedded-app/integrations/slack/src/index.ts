import { componentManifests, integration } from "@prismatic-io/spectral";
import documentation from "../documentation.md";
import { integrationConfiguration } from "./configuration";
import flows from "./flows";

/** This integration calls Slack's API directly, so the registry is empty. */
export const componentRegistry = componentManifests({});

export { integrationConfiguration } from "./configuration";

export default integration({
  name: "Slack Notifications",
  description: "Posts Acme notifications to a Slack channel you choose",
  category: "Communication",
  labels: ["headless", "example", "one-click"],
  iconPath: "icon.png",
  documentation,
  flows,
  configuration: integrationConfiguration,
  componentRegistry,
});
