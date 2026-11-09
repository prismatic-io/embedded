import { computed, Injectable, signal } from "@angular/core";
import prismatic from "@prismatic-io/embedded";

/** Refresh this many seconds before the token expires. */
const REFRESH_MARGIN_SECONDS = 30;

/**
 * Fetches a signed JWT from our backend (server.ts), hands it to the embedded
 * SDK, and refreshes it before it expires. Components read `token` to know
 * when Prismatic is ready.
 */
@Injectable({ providedIn: "root" })
export class PrismaticAuth {
  readonly token = signal<string | null>(null);
  readonly prismaticUrl = signal("");
  readonly error = signal<string | null>(null);
  /** Changes once, unlike `token`, so it doesn't re-render embeds on refresh. */
  readonly ready = computed(() => this.token() !== null);

  constructor() {
    this.connect();
  }

  private async connect() {
    try {
      const response = await fetch("/api/prismatic-auth");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);

      // `init` resets the SDK, so call it once. Refreshes only re-authenticate.
      if (!this.ready()) prismatic.init({ prismaticUrl: body.prismaticUrl });
      await prismatic.authenticate({ token: body.token });

      this.prismaticUrl.set(body.prismaticUrl);
      this.token.set(body.token);
      setTimeout(() => this.connect(), (body.expiresIn - REFRESH_MARGIN_SECONDS) * 1000);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }
}
