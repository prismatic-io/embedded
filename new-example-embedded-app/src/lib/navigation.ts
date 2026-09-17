import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Building2,
  Gauge,
  Languages,
  LayoutDashboard,
  LayoutGrid,
  PictureInPicture2,
  Plug,
  Settings2,
  SlidersHorizontal,
  Store,
  UserSearch,
  Users,
} from "lucide-react";

export interface NavItem {
  title: string;
  to: LinkProps["to"];
  icon?: LucideIcon;
  description?: string;
}

/** Placeholder roots filled with example data */
export const workspaceNav: NavItem[] = [
  { title: "Dashboard", to: "/", icon: LayoutDashboard },
  { title: "Leads", to: "/placeholder/leads", icon: UserSearch },
  { title: "Contacts", to: "/placeholder/contacts", icon: Users },
  { title: "Accounts", to: "/placeholder/accounts", icon: Building2 },
];

/** Examples of how to embed Prismatic in an app */
export const prismaticNav: NavItem[] = [
  {
    title: "Basic Integration Marketplace",
    to: "/examples/basic-embedded-marketplace",
    icon: Store,
  },
  {
    title: "Basic Marketplace Popover",
    to: "/examples/basic-marketplace-popover",
    icon: PictureInPicture2,
  },
  {
    title: "Custom Marketplace UI",
    to: "/examples/custom-marketplace-ui",
    icon: LayoutGrid,
  },
  {
    title: "Edit Instance Configuration",
    to: "/examples/edit-instance-configuration",
    icon: Settings2,
  },
  {
    title: "Screen Configuration",
    to: "/examples/screen-configuration",
    icon: SlidersHorizontal,
  },
  {
    title: "Translations and i18n",
    to: "/examples/translations",
    icon: Languages,
  },
  {
    title: "Reusable Connections",
    to: "/examples/connections",
    icon: Plug,
  },
  {
    title: "Customer Dashboard",
    to: "/examples/dashboard",
    icon: Gauge,
  },
  {
    title: "Chat Bot",
    to: "/examples/chat-bot",
    icon: Bot,
  },
];
