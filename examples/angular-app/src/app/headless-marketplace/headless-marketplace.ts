import {
  Component,
  DestroyRef,
  type ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import {
  type Client,
  createClient,
  type IntegrationStub,
  type VisibleFrameMount,
} from "@prismatic-io/solis-core";
import type { MarketplaceIntegrationState } from "@prismatic-io/solis-core/protocol";
import { type HeadlessTarget, HeadlessSetup } from "./headless-setup/headless-setup";
import { PrismaticAuth } from "../prismatic-auth";

interface Listing {
  stub: IntegrationStub;
  state: MarketplaceIntegrationState;
}

/**
 * Your own marketplace UI, built on @prismatic-io/solis-core. Setup opens in a
 * popover:
 *
 * - "hosted" integrations get Prismatic's configuration wizard in an iframe.
 * - "headless" integrations get this app's own form (see headless-setup/headless-setup.ts).
 */
@Component({
  imports: [HeadlessSetup],
  template: `
    <h2>Headless Marketplace</h2>
    @if (status(); as status) {
      <p>{{ status }}</p>
    }
    <div class="cards">
      @for (listing of listings(); track listing.state.id) {
        <div class="card">
          <div class="card-header">
            @if (avatars()[listing.state.id]; as src) {
              <img class="avatar" [src]="src" alt="" />
            } @else {
              <span class="avatar">{{ listing.state.name.slice(0, 2).toUpperCase() }}</span>
            }
            <div>
              <strong>{{ listing.state.name }}</strong>
              <small>{{ listing.state.category ?? "Uncategorized" }}</small>
            </div>
          </div>
          <p>{{ listing.state.description }}</p>
          <div class="badges">
            <span class="badge">{{ listing.state.configurationExperience }}</span>
            @if (listing.state.instances.length) {
              <span class="badge installed">Installed</span>
            }
          </div>
          <div class="card-actions">
            <button (click)="configure(listing)" [disabled]="busy()">
              {{ listing.state.instances.length ? "Reconfigure" : "Deploy" }}
            </button>
            @if (listing.state.instances.length) {
              <button class="danger" (click)="remove(listing)" [disabled]="busy()">Remove</button>
            }
          </div>
        </div>
      }
    </div>

    <!-- Closing the popover, by any means, removes what's in it. -->
    <dialog #popover class="popover" (close)="closed()">
      <header>
        <h3>Configure {{ popoverTitle() }}</h3>
        <button class="close" (click)="popover.close()" aria-label="Close">✕</button>
      </header>
      @if (headless(); as target) {
        <app-headless-setup [target]="target" (deployed)="popover.close()" />
      }
      <!-- The hosted wizard's iframe goes here. CSS hides it while it's empty. -->
      <div #frame class="wizard-frame"></div>
    </dialog>
  `,
})
export class HeadlessMarketplace {
  private readonly auth = inject(PrismaticAuth);
  private readonly popover = viewChild.required<ElementRef<HTMLDialogElement>>("popover");
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>("frame");
  private client?: Client;
  private mount?: VisibleFrameMount;
  private destroyed = false;

  protected readonly listings = signal<Listing[]>([]);
  /** Image links by integration id. */
  protected readonly avatars = signal<Record<string, string>>({});
  protected readonly popoverTitle = signal("");
  protected readonly headless = signal<HeadlessTarget | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      const token = this.auth.token();
      if (!token) return;
      // A refreshed token for the same user keeps every stub valid.
      if (this.client) this.client.authenticate(token);
      else this.run("Loading integrations…", () => this.load(token));
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.client?.dispose();
    });
  }

  private async load(jwt: string) {
    const client = await createClient({ prismaticUrl: this.auth.prismaticUrl(), jwt });
    if (this.destroyed) return client.dispose();
    this.client = client;

    const page = await client.authenticated!.marketplace.list({
      includeActiveIntegrations: true,
    });
    for (const stub of page.integrations as unknown as IntegrationStub[]) {
      // The stream ends with an error when the client is disposed.
      this.watch(stub).catch(() => {});
    }
  }

  /** Each listing's `state()` stream emits now, and again after every change. */
  private async watch(stub: IntegrationStub) {
    const reader = (await stub.state()).getReader();
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      const state = next.value;
      // Without an image, the card shows the integration's initials.
      this.loadAvatar(state).catch(() => {});
      this.listings.update((listings) =>
        [...listings.filter((l) => l.state.id !== state.id), { stub, state }].sort((a, b) =>
          a.state.name.localeCompare(b.state.name),
        ),
      );
    }
  }

  /**
   * `avatarUrl` is a path on your Prismatic stack. An authenticated request
   * to it returns `{ url }`, a short-lived link to the image itself.
   */
  private async loadAvatar({ id, avatarUrl }: MarketplaceIntegrationState) {
    if (!avatarUrl || this.avatars()[id]) return;
    const response = await fetch(`${this.auth.prismaticUrl()}${avatarUrl}`, {
      headers: { Authorization: `Bearer ${this.auth.token()}` },
    });
    const { url } = await response.json();
    if (url) this.avatars.update((avatars) => ({ ...avatars, [id]: url }));
  }

  protected configure({ stub, state }: Listing) {
    return this.run(`Opening ${state.name}…`, async () => {
      // Reuse the customer's instance, or create a never-deployed one.
      const [existing] = await stub.instances();
      const instance = existing ?? (await stub.createInstance({ name: state.name }));

      // The version being configured decides who renders its configuration.
      // The listing's `configurationExperience` is only its latest version's.
      const config = await instance.configuration();
      const configState = await config.refresh();
      const popover = this.popover().nativeElement;
      this.popoverTitle.set(state.name);

      if (configState.configurationExperience === "hosted") {
        // The wizard deploys the instance itself. When it finishes, close the popover.
        this.mount = await this.client!.openVisibleFrame({
          url: `/configure-instance/${encodeURIComponent(configState.instanceId)}/?reconfigure=true`,
          container: this.frame().nativeElement,
          title: `Configure ${state.name}`,
          onClose: () => popover.close(),
        });
      } else {
        this.headless.set({ client: this.client!, instance, config, state: configState });
      }
      // For the wizard, this waits until it's ready, so the popover never opens blank.
      popover.showModal();
    });
  }

  /**
   * Deletes the customer's instance: it stops running, and its configuration
   * goes with it. Changing an instance through this session re-reads the
   * listing, so the card updates on its own.
   */
  protected remove({ stub, state }: Listing) {
    if (
      !window.confirm(`Remove ${state.name}? It stops running, and its configuration is deleted.`)
    ) {
      return;
    }
    return this.run(`Removing ${state.name}…`, async () => {
      const [instance] = await stub.instances();
      if (!instance) return;
      const { permissions } = await instance.refresh();
      if (!permissions.remove.allowed) {
        throw new Error(`You can't remove ${state.name} (${permissions.remove.reason}).`);
      }
      await instance.delete();
    });
  }

  protected closed() {
    this.mount?.dispose();
    this.mount = undefined;
    this.headless.set(null);
  }

  /** Shows `message` while `task` runs, and its error if it fails. */
  private async run(message: string, task: () => Promise<unknown>) {
    this.busy.set(true);
    this.status.set(message);
    try {
      await task();
      this.status.set(null);
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy.set(false);
    }
  }
}
