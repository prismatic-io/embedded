import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  DollarSign,
  TrendingUp,
  UserSearch,
  Users,
} from "lucide-react";

import { Page } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { activity, pipelineByStage } from "@/lib/fake-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/")({ component: Dashboard });

const stats = [
  {
    label: "Open pipeline",
    value: "$1.19M",
    delta: "+12.4%",
    icon: DollarSign,
  },
  { label: "New leads", value: "248", delta: "+8.1%", icon: UserSearch },
  { label: "Active contacts", value: "1,904", delta: "+2.7%", icon: Users },
  { label: "Win rate", value: "31%", delta: "+1.9%", icon: TrendingUp },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function Dashboard() {
  const session = useSession();
  const maxStage = Math.max(...pipelineByStage.map((s) => s.value));

  return (
    <Page
      title={`Welcome back, ${session.userName.split(" ")[0]}`}
      description={`This demo app demonstrates various features of the @prismatic-io/embedded package. Review examples in the sidebar and check out the source code to see how they work.`}
    >
      <div className="grid grid-cols-4 gap-4">
        {stats.map(({ label, value, delta, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardDescription>{label}</CardDescription>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">
                {value}
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="size-3" />
                {delta} vs. last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-5 gap-4">
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Pipeline by stage</CardTitle>
            <CardDescription>Weighted value, current quarter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pipelineByStage.map(({ stage, value }) => (
              <div key={stage} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>{stage}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {currency.format(value)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-600"
                    style={{ width: `${(value / maxStage) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Across your accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.map((item) => (
              <div key={item.id} className="text-sm">
                <p>
                  <span className="font-medium">{item.who}</span>{" "}
                  <span className="text-muted-foreground">{item.what}</span>
                </p>
                <p className="text-xs text-muted-foreground">{item.when}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Integrations</CardTitle>
            <Badge variant="secondary">Coming next</Badge>
          </div>
          <CardDescription>
            This app embeds Prismatic. The examples appear in the sidebar as we
            add them.
          </CardDescription>
        </CardHeader>
      </Card>
    </Page>
  );
}
