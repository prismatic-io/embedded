import prismatic from "@prismatic-io/embedded";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";
import { useTheme } from "#/components/theme-provider";
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";

export const Route = createFileRoute("/examples/connections")({
  component: RouteComponent,
});

function RouteComponent() {
  const { authenticated, error } = usePrismaticAuth();
  const { theme } = useTheme();

  useEffect(() => {
    if (error) {
      console.error("Prismatic authentication error:", error);
    }
    if (authenticated) {
      prismatic.showConnections({
        selector: "#my-embedded-connections",
        theme: theme === "light" ? "LIGHT" : "DARK",
      });
    }
  }, [authenticated, error, theme]);

  return (
    <Page
      title="Reusable Connections"
      description="This page demonstrates how to show a user the reusable connections they share across their integrations."
      actions={<HelperText id="connections" />}
      fullHeight
    >
      <div className="relative h-full">
        <div id="my-embedded-connections" className="h-full" />
        {!authenticated && <EmbedLoading label="Loading connections" />}
      </div>
    </Page>
  );
}
