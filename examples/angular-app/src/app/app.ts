import { Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { PrismaticAuth } from "./prismatic-auth";

@Component({
  selector: "app-root",
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav>
      <h1>Acme SaaS</h1>
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
      <a routerLink="/hosted" routerLinkActive="active">Marketplace</a>
      <a routerLink="/custom" routerLinkActive="active">Custom Marketplace</a>
    </nav>
    <main>
      @if (auth.error(); as error) {
        <p class="error">Could not authenticate with Prismatic: {{ error }}</p>
      }
      <router-outlet />
    </main>
  `,
})
export class App {
  protected readonly auth = inject(PrismaticAuth);
}
