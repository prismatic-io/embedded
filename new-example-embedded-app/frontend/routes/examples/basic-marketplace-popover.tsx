import prismatic from "@prismatic-io/embedded";
import { createFileRoute } from "@tanstack/react-router";
import { EmbedLoading } from "#/components/embed-loading";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";
import { useTheme } from "#/components/theme-provider";
import { Button } from "#/components/ui/button";
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";

export const Route = createFileRoute("/examples/basic-marketplace-popover")({
  component: RouteComponent,
});

function RouteComponent() {
  const { authenticated } = usePrismaticAuth();
  const { theme } = useTheme();

  return (
    <Page
      title="Basic Marketplace with Popover"
      description="This page demonstrates how to embed the integration marketplace into your app as an iframe that opens in a popover."
      actions={<HelperText id="basic-marketplace-popover" />}
      fullHeight
    >
      <div className="relative h-full">
        {authenticated ? (
          <Button
            onClick={() => {
              prismatic.showMarketplace({
                usePopover: true,
                theme: theme === "light" ? "LIGHT" : "DARK",
              });
            }}
          >
            Open Marketplace
          </Button>
        ) : (
          <EmbedLoading label="Loading the integration marketplace" />
        )}
      </div>
    </Page>
  );
}
