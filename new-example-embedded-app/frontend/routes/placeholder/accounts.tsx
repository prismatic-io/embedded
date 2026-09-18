import { createFileRoute } from "@tanstack/react-router";

import { Page } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Account, accounts } from "@/lib/fake-data";

export const Route = createFileRoute("/placeholder/accounts")({
  component: Accounts,
});

const healthVariant: Record<
  Account["health"],
  "default" | "secondary" | "destructive"
> = {
  Healthy: "secondary",
  "At risk": "default",
  "Churn risk": "destructive",
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function Accounts() {
  return (
    <Page
      title="Accounts"
      description="Sample data. This page is not connected to anything."
    >
      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">ARR</TableHead>
              <TableHead>Health</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {account.industry}
                </TableCell>
                <TableCell>{account.owner}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {currency.format(account.arr)}
                </TableCell>
                <TableCell>
                  <Badge variant={healthVariant[account.health]}>
                    {account.health}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Page>
  );
}
