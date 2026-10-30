import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { App } from "./app/app";
import { CustomMarketplace } from "./app/custom-marketplace";
import { Dashboard } from "./app/dashboard";
import { HostedMarketplace } from "./app/hosted-marketplace";

bootstrapApplication(App, {
  providers: [
    provideRouter([
      { path: "", component: Dashboard },
      { path: "hosted", component: HostedMarketplace },
      { path: "custom", component: CustomMarketplace },
    ]),
  ],
}).catch(console.error);
