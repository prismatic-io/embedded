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
  type ConfigurationStub,
  createClient,
  type InstanceStub,
  type IntegrationStub,
  type VisibleFrameMount,
} from "@prismatic-io/solis-core";
import type { MarketplaceIntegrationState } from "@prismatic-io/solis-core/protocol";
import { PrismaticAuth } from "./prismatic-auth";

interface Listing {
  stub: IntegrationStub;
  state: MarketplaceIntegrationState;
}

/** A headless configuration being edited, prefilled with `init`'s suggestion. */
interface Draft {
  name: string;
  instance: InstanceStub;
  config: ConfigurationStub;
  json: string;
}

/**
 * Your own marketplace UI, built on @prismatic-io/solis-core.
 *
 * - "hosted" integrations open Prismatic's configuration wizard in an iframe.
 * - "headless" integrations are configured by this app: here, a JSON editor
 *   prefilled by the integration's `init`, then saved and deployed.
 */
@Component({
  template: `
    <h2>Custom Marketplace</h2>
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
          <button (click)="configure(listing)" [disabled]="busy()">
            {{ listing.state.instances.length ? "Reconfigure" : "Deploy" }}
          </button>
        </div>
      }
    </div>
    @if (draft(); as draft) {
      <div class="panel">
        <h3>Configure {{ draft.name }}</h3>
        <textarea #json rows="12" [value]="draft.json"></textarea>
        <button (click)="saveAndDeploy(draft, json.value)" [disabled]="busy()">Save and deploy</button>
        <button (click)="this.draft.set(null)">Cancel</button>
      </div>
    }
    <!-- A popover for the hosted wizard. Closing it, by any means, removes the wizard. -->
    <dialog #wizard class="wizard" (close)="mount?.dispose()">
      <button class="close" (click)="wizard.close()" aria-label="Close">✕</button>
      <div #frame class="wizard-frame"></div>
    </dialog>
  `,
})
export class CustomMarketplace {
  private readonly auth = inject(PrismaticAuth);
  private readonly wizard = viewChild.required<ElementRef<HTMLDialogElement>>("wizard");
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>("frame");
  private client?: Client;
  protected mount?: VisibleFrameMount;
  private destroyed = false;

  protected readonly listings = signal<Listing[]>([]);
  /** Image links by integration id. */
  protected readonly avatars = signal<Record<string, string>>({});
  protected readonly draft = signal<Draft | null>(null);
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

      if (state.configurationExperience === "hosted") {
        const { id } = await instance.refresh();
        this.mount?.dispose();
        const dialog = this.wizard().nativeElement;
        // The wizard deploys the instance itself. When it finishes, close the popover.
        this.mount = await this.client!.openVisibleFrame({
          url: `/configure-instance/${encodeURIComponent(id)}/?reconfigure=true`,
          container: this.frame().nativeElement,
          title: `Configure ${state.name}`,
          onClose: () => dialog.close(),
        });
        // Show the popover once the wizard is ready, so it never opens blank.
        dialog.showModal();
      } else {
        const config = await instance.configuration();
        const suggested = await config.init({});
        if (suggested.status === "error") throw suggested.error;
        const { configuration } = suggested.data as { configuration: unknown };
        this.draft.set({
          name: state.name,
          instance,
          config,
          json: JSON.stringify(configuration, null, 2),
        });
      }
    });
  }

  protected saveAndDeploy(draft: Draft, json: string) {
    return this.run(`Deploying ${draft.name}…`, async () => {
      // Prismatic validates the value against the integration's schema.
      const saved = await draft.config.save({ value: JSON.parse(json) });
      if (saved.status === "error") throw saved.error;
      await draft.instance.deploy();
      this.draft.set(null);
    });
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
