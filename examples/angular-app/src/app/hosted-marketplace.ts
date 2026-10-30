import { afterRenderEffect, Component, inject } from "@angular/core";
import prismatic from "@prismatic-io/embedded";
import { PrismaticAuth } from "./prismatic-auth";

/** Prismatic's own marketplace UI, embedded as an iframe with @prismatic-io/embedded. */
@Component({
  template: `
    <h2>Marketplace</h2>
    <div id="marketplace" class="embed"></div>
  `,
})
export class HostedMarketplace {
  constructor() {
    const auth = inject(PrismaticAuth);
    // Runs after the #marketplace element renders, and again once auth is ready.
    afterRenderEffect(() => {
      if (auth.ready()) prismatic.showMarketplace({ selector: "#marketplace" });
    });
  }
}
