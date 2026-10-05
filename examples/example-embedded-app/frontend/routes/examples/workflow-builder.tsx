import prismatic from "@prismatic-io/embedded";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";
import { useTheme } from "#/components/theme-provider";
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";

export const Route = createFileRoute("/examples/workflow-builder")({
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
      prismatic.showWorkflows({
        selector: "#my-embedded-workflows",
        theme: theme === "light" ? "LIGHT" : "DARK",
      });
    }
  }, [authenticated, error, theme]);

  return (
    <Page
      title="Embedded Workflow Builder"
      description="This page demonstrates how to embed the workflows screen, where your customer's users build and manage their own workflows."
      actions={<HelperText id="workflow-builder" />}
      fullHeight
    >
      <div className="relative h-full">
        <div id="my-embedded-workflows" className="h-full" />
        {!authenticated && <EmbedLoading label="Loading workflows" />}
      </div>
    </Page>
  );
}
