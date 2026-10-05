import { createFileRoute } from "@tanstack/react-router";

import { Page } from "@/components/page";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { contacts } from "@/lib/fake-data";

export const Route = createFileRoute("/placeholder/contacts")({
  component: Contacts,
});

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

function Contacts() {
  return (
    <Page
      title="Contacts"
      description="Sample data. This page is not connected to anything."
    >
      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Last touch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[10px]">
                        {initials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{contact.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.title}
                </TableCell>
                <TableCell>{contact.account}</TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.email}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {contact.lastTouch}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Page>
  );
}
