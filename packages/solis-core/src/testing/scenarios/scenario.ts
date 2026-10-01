import type { PrismaticApi } from "../../protocol/index.js";
import type { World, WorldConnectionStatus } from "./world.js";

/** The matchers scenarios use, so a runner can pass its own test framework's `expect`. */
export interface ScenarioMatchers {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toMatchObject(expected: object): void;
  toContain(expected: unknown): void;
  not: ScenarioMatchers;
  rejects: {
    toThrow(expected?: string | RegExp): Promise<void>;
    toMatchObject(expected: object): Promise<void>;
  };
}

export type ScenarioExpect = (actual: unknown) => ScenarioMatchers;

export interface ScenarioContext {
  /**
   * Authenticates as a world user over the protocol. Signing in as someone else revokes the
   * previous identity's stubs, as the frame does, so re-read after switching.
   */
  signIn: (principal: string) => Promise<PrismaticApi>;
  expect: ScenarioExpect;
  /** Changes made on the platform outside the session. */
  backend: ScenarioBackend;
}

export interface ScenarioBackend {
  /** A connection's status changes, as the provider's answer to consent lands. */
  setConnectionStatus: (name: string, status: WorldConnectionStatus) => void;
}

export interface Scenario {
  id: string;
  title: string;
  world: World;
  /** Why the fake frame is expected to fail this scenario. Its runner asserts that it still
   * does, so fixing the fake forces this marker to be removed. */
  knownFakeGap?: string;
  run: (context: ScenarioContext) => Promise<void>;
}
