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
import { type Lead, leads } from "@/lib/fake-data";

export const Route = createFileRoute("/placeholder/leads")({
  component: Leads,
});

const statusVariant: Record<
  Lead["status"],
  "default" | "secondary" | "outline"
> = {
  Qualified: "default",
  Working: "secondary",
  New: "outline",
  Unqualified: "outline",
};

function Leads() {
  return (
    <Page
      title="Leads"
      description="Sample data. This page is not connected to anything."
    >
      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">{lead.name}</TableCell>
                <TableCell>{lead.company}</TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.source}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {lead.score}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[lead.status]}>
                    {lead.status}
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
