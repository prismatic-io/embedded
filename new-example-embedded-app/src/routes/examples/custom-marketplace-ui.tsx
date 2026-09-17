import prismatic from "@prismatic-io/embedded";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";
import { useTheme } from "#/components/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";

export const Route = createFileRoute("/examples/custom-marketplace-ui")({
  component: RouteComponent,
});

const GET_MARKETPLACE_INTEGRATIONS_QUERY = `
  query getMarketplaceIntegrations {
    marketplaceIntegrations(
      includeActiveIntegrations: true
      sortBy: [
        { field: CATEGORY, direction: ASC }
        { field: NAME, direction: ASC }
      ]
    ) {
      nodes {
        id
        name
        allowMultipleMarketplaceInstances
        avatarUrl
        category
        description
        isCustomerDeployable
        marketplaceConfiguration
        overview
        versionNumber
        firstDeployedInstance {
          id
        }
        deployedInstances
        deploymentStatus
      }
    }
  }
`;

interface MarketplaceIntegration {
  id: string;
  name: string;
  allowMultipleMarketplaceInstances: boolean;
  avatarUrl?: string;
  category: string;
  description: string;
  isCustomerDeployable: boolean;
  marketplaceConfiguration: string;
  overview: string;
  versionNumber: number;
  firstDeployedInstance?: {
    id: string;
  };
  deployedInstances: "ZERO" | "ONE" | "MULTIPLE";
  deploymentStatus?: "ACTIVATED" | "PAUSED" | "UNCONFIGURED";
}

type MarketplaceIntegrationsResponse = {
  data: {
    marketplaceIntegrations: {
      nodes: MarketplaceIntegration[];
    };
  };
};

function RouteComponent() {
  const { authenticated, error } = usePrismaticAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [marketplaceIntegrations, setMarketplaceIntegrations] = useState<
    MarketplaceIntegration[]
  >([]);

  useEffect(() => {
    let canceled = false;

    const loadMarketplace = async () => {
      // Query the Prismatic API for marketplace integrations
      const response = (await prismatic.graphqlRequest({
        query: GET_MARKETPLACE_INTEGRATIONS_QUERY,
      })) as MarketplaceIntegrationsResponse;

      if (canceled) return;

      setMarketplaceIntegrations(response.data.marketplaceIntegrations.nodes);
      setLoading(false);
    };

    if (authenticated) {
      loadMarketplace();
    }

    return () => {
      canceled = true;
    };
  }, [authenticated]);

  // Open the configuration wizard for an integration in a popover. An
  // integration the customer already deployed opens by instance id.
  const openConfiguration = (integration: MarketplaceIntegration) => {
    prismatic.configureInstance({
      ...(integration.firstDeployedInstance
        ? { instanceId: integration.firstDeployedInstance.id }
        : { integrationName: integration.name }),
      usePopover: true,
      skipRedirectOnRemove: false,
      theme: theme === "light" ? "LIGHT" : "DARK",
      screenConfiguration: {
        isInPopover: true,
        configurationWizard: {
          isInModal: true,
        },
      },
    });
  };

  if (error) {
    return (
      <PageWrapper>
        <div>Error authenticating with Prismatic: {error.message}</div>
      </PageWrapper>
    );
  }

  if (!authenticated || loading) {
    return (
      <PageWrapper>
        <EmbedLoading label="Loading the integration marketplace" />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="h-full overflow-y-auto">
        {marketplaceIntegrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This customer has no integrations in the marketplace.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {marketplaceIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onConfigure={() => openConfiguration(integration)}
              />
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

const DEPLOYMENT_STATUS = {
  ACTIVATED: { label: "Active", variant: "default" },
  PAUSED: { label: "Paused", variant: "secondary" },
  UNCONFIGURED: { label: "Needs setup", variant: "outline" },
} as const;

function IntegrationCard({
  integration,
  onConfigure,
}: {
  integration: MarketplaceIntegration;
  onConfigure: () => void;
}) {
  const { token, prismaticUrl } = usePrismaticAuth();
  const [avatarSrc, setSrc] = useState("");
  const deployed = integration.deployedInstances !== "ZERO";
  const status = integration.deploymentStatus
    ? DEPLOYMENT_STATUS[integration.deploymentStatus]
    : null;

  /**
   * To get the avatar URL, we need to send an authenticated request to the
   * Prismatic API in exchange for a presigned URL to the avatar image.
   */
  useEffect(() => {
    let mounted = true;
    if (!integration.avatarUrl) {
      return;
    }

    fetch(`${prismaticUrl}${integration.avatarUrl}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (mounted) {
          setSrc(data.url);
        }
      });
    return () => {
      mounted = false;
    };
  }, [integration.avatarUrl, token, prismaticUrl]);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <Avatar className="mb-1 size-10 rounded-md after:rounded-md">
          <AvatarImage
            src={avatarSrc}
            alt=""
            className="rounded-md bg-muted object-contain p-1"
          />
          <AvatarFallback className="rounded-md font-medium">
            {integration.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <CardTitle>{integration.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {integration.description ||
            integration.overview ||
            "No description provided."}
        </CardDescription>
        {status ? (
          <CardAction>
            <Badge variant={status.variant}>{status.label}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-wrap items-end gap-2 text-xs text-muted-foreground">
        {integration.category ? (
          <Badge variant="outline">{integration.category}</Badge>
        ) : null}
        <span>Version {integration.versionNumber}</span>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={deployed ? "outline" : "default"}
          disabled={!integration.isCustomerDeployable}
          onClick={onConfigure}
        >
          {deployed ? "Configure" : "Install"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Page
      title="Custom Marketplace UI"
      description="This page demonstrates how to embed the integration marketplace into your app with a custom UI."
      actions={<HelperText id="custom-marketplace-ui" />}
      fullHeight
    >
      <div className="relative h-full">{children}</div>
    </Page>
  );
}
