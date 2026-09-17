import prismatic from "@prismatic-io/embedded";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";
import { useTheme } from "#/components/theme-provider";
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";

export const Route = createFileRoute("/examples/basic-embedded-marketplace")({
  component: RouteComponent,
});

function RouteComponent() {
  const { authenticated, token, error } = usePrismaticAuth();
  const { theme } = useTheme();

  useEffect(() => {
    if (error) {
      console.error("Prismatic authentication error:", error);
    }
    if (authenticated && token) {
      prismatic.showMarketplace({
        selector: "#my-embedded-marketplace",
        theme: theme === "light" ? "LIGHT" : "DARK",
      });
    }
  }, [authenticated, token, error, theme]);

  return (
    <Page
      title="Basic Embedded Marketplace"
      description="This page demonstrates how to embed the integration marketplace into your app as an iframe."
      actions={<HelperText id="basic-example-marketplace" />}
      fullHeight
    >
      <div className="relative h-full">
        <div id="my-embedded-marketplace" className="h-full" />
        {!authenticated && (
          <EmbedLoading label="Loading the integration marketplace" />
        )}
      </div>
    </Page>
  );
}
