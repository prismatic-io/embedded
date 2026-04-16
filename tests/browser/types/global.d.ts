export {};

declare global {
  interface Window {
    prismatic: typeof import("@prismatic-io/embedded").default;
  }
}
