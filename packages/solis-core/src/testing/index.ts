/** Test doubles for host code. Requires jsdom; not part of the runtime surface. */

export type {
  FakeConfigurationSeed,
  FakeConnectionTemplate,
  FakeEmbeddedRole,
  FakeFrame,
  FakeFrameOptions,
  FakeInstanceSeed,
  FakeStores,
  FakeUserConfigurationSeed,
  InstanceRecord,
  UserConfigurationRecord,
} from "./fakeFrame.js";
export {
  FakeCollection,
  FakePreAuthApi,
  FakePrismaticApi,
  fakeConnectionState,
  fakeInstanceState,
  fakeIntegrationState,
  fakeUserConfigurationRecord,
  installFakeFrame,
  withConnectionStatus,
} from "./fakeFrame.js";
