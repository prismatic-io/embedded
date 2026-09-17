import prismatic, { type ScreenConfiguration } from "@prismatic-io/embedded";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";
import {
  Playground,
  PlaygroundChips,
  PlaygroundOptions,
  PlaygroundSection,
} from "#/components/playground";
import { useTheme } from "#/components/theme-provider";
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";

export const Route = createFileRoute("/examples/dashboard")({
  component: RouteComponent,
});

type DashboardTab = NonNullable<
  NonNullable<ScreenConfiguration["dashboard"]>["hideTabs"]
>[number];

const TABS = [
  "Attachments",
  "Components",
  "Credentials",
  "Executions",
  "Instances",
  "Integrations",
  "Logs",
  "Marketplace",
] as const satisfies readonly DashboardTab[];

function RouteComponent() {
  const { authenticated, error } = usePrismaticAuth();
  const { theme } = useTheme();
  const [hideTabs, setHideTabs] = useState<DashboardTab[]>([]);

  // The customer's own permissions decide which tabs exist. `hideTabs` only
  // removes tabs your app does not want the customer to reach.
  const screenConfiguration: ScreenConfiguration = {
    dashboard: { hideTabs },
  };

  const hidden = JSON.stringify(hideTabs);

  useEffect(() => {
    if (error) {
      console.error("Prismatic authentication error:", error);
    }
    if (authenticated) {
      prismatic.showDashboard({
        selector: "#my-embedded-dashboard",
        theme: theme === "light" ? "LIGHT" : "DARK",
        screenConfiguration: {
          dashboard: { hideTabs: JSON.parse(hidden) as DashboardTab[] },
        },
      });
    }
  }, [authenticated, error, theme, hidden]);

  return (
    <Page
      title="Customer Dashboard"
      description="This page demonstrates how to embed the customer dashboard, where a customer reviews their instances, logs, and connections in one place."
      actions={<HelperText id="dashboard" />}
      fullHeight
    >
      <Playground
        controls={
          <PlaygroundSection
            title="Hidden tabs"
            description="Select a tab to remove it from the dashboard."
          >
            <PlaygroundChips
              values={hideTabs}
              options={TABS}
              onChange={setHideTabs}
            />
          </PlaygroundSection>
        }
        options={
          <PlaygroundOptions
            code={JSON.stringify(screenConfiguration, null, 2)}
          />
        }
      >
        <div id="my-embedded-dashboard" className="h-full" />
        {!authenticated && <EmbedLoading label="Loading the dashboard" />}
      </Playground>
    </Page>
  );
}
