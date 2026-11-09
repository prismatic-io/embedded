import type { Routes } from "@angular/router";
import { Dashboard } from "./dashboard/dashboard";
import { HeadlessMarketplace } from "./headless-marketplace/headless-marketplace";
import { HostedMarketplace } from "./hosted-marketplace/hosted-marketplace";

export const routes: Routes = [
  { path: "", component: Dashboard },
  { path: "hosted", component: HostedMarketplace },
  { path: "headless", component: HeadlessMarketplace },
];
