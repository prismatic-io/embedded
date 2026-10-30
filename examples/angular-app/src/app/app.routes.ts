import type { Routes } from "@angular/router";
import { CustomMarketplace } from "./custom-marketplace/custom-marketplace";
import { Dashboard } from "./dashboard/dashboard";
import { HostedMarketplace } from "./hosted-marketplace/hosted-marketplace";

export const routes: Routes = [
  { path: "", component: Dashboard },
  { path: "hosted", component: HostedMarketplace },
  { path: "custom", component: CustomMarketplace },
];
