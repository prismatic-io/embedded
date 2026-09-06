/**
 * Context the agent consults to learn your application's domain language, the
 * components you expect it to use, or details about the signed-in user. Keyed
 * by topic; values are plain text — prose, markdown, or serialized JSON.
 */
export type AgentContext = Record<string, string>;

export interface AgentConfiguration {
  context?: AgentContext;
}
