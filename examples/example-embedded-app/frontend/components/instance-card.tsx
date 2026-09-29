import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** One integration the customer already deployed. */
export interface Instance {
  id: string;
  name: string;
  enabled: boolean;
  lastExecutedAt: string | null;
  integration: {
    name: string;
    description: string;
    category: string;
  };
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const lastRun = (value: string | null) =>
  value ? `Last run ${dateFormat.format(new Date(value))}` : "Never run";

/**
 * There is no Prismatic code in this file. The example that uses it is
 * `frontend/routes/examples/edit-instance-configuration.tsx`.
 */
export function InstanceCard({
  instance,
  onConfigure,
}: {
  instance: Instance;
  onConfigure: () => void;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle>{instance.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {instance.integration.description || "No description provided."}
        </CardDescription>
        <CardAction>
          <Badge variant={instance.enabled ? "default" : "secondary"}>
            {instance.enabled ? "Enabled" : "Paused"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-wrap items-end gap-2 text-xs text-muted-foreground">
        {instance.integration.category ? (
          <Badge variant="outline">{instance.integration.category}</Badge>
        ) : null}
        <span>{lastRun(instance.lastExecutedAt)}</span>
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant="outline" onClick={onConfigure}>
          Configure
        </Button>
      </CardFooter>
    </Card>
  );
}
