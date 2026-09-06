import { test as base } from "@playwright/test";
import { startStubServer } from "./stub-server.mjs";

type Stub = {
  url: string;
  close: () => Promise<void>;
};

export const test = base.extend<object, { stub: Stub }>({
  stub: [
    // biome-ignore lint/correctness/noEmptyPattern: fixtures require `{}` arg.
    async ({}, use) => {
      const stub = await startStubServer();
      await use(stub);
      await stub.close();
    },
    { scope: "worker" },
  ],
});

export { expect } from "@playwright/test";
