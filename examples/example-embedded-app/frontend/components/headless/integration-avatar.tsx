import type { InstanceResource, ListItem } from "@prismatic-io/solis-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";
import { cn } from "#/lib/utils";

/** A label and badge variant for each instance lifecycle. */
export const LIFECYCLE_LABELS = {
  notDeployed: { label: "Not deployed", variant: "outline" },
  needsReconfiguration: { label: "Needs review", variant: "destructive" },
  needsUserConfiguration: { label: "Needs your setup", variant: "outline" },
  paused: { label: "Paused", variant: "secondary" },
  pendingChanges: { label: "Changes not deployed", variant: "outline" },
  active: { label: "Active", variant: "default" },
} as const;

/**
 * An integration's icon. `avatarUrl` is a path on your Prismatic stack. An
 * authenticated request to it returns `{ url }`, a short-lived link to the
 * image itself.
 */
export function IntegrationAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl: string | null;
  className?: string;
}) {
  const { token, prismaticUrl } = usePrismaticAuth();
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!avatarUrl || !token) return;
    let mounted = true;
    fetch(`${prismaticUrl}${avatarUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((body: { url?: string }) => {
        if (mounted && body.url) setSrc(body.url);
      })
      .catch(() => {
        // Keep the fallback initials.
      });
    return () => {
      mounted = false;
    };
  }, [avatarUrl, token, prismaticUrl]);

  return (
    <Avatar
      className={cn("mb-1 size-10 rounded-md after:rounded-md", className)}
    >
      <AvatarImage
        src={src}
        alt=""
        className="rounded-md bg-muted object-contain p-1"
      />
      <AvatarFallback className="rounded-md font-medium">
        {name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * The customer's instance of an integration, skipping any that were just
 * removed. A removed instance's resource turns to `PRISMATIC_INSTANCE_REMOVED`
 * right away, and can stay in the listing until the listing reloads.
 */
export function currentInstance<T extends ListItem<InstanceResource>>(
  instances: readonly T[],
): T | undefined {
  return instances.find(
    (instance) =>
      !(
        instance.status === "error" &&
        instance.error.code === "PRISMATIC_INSTANCE_REMOVED"
      ),
  );
}
