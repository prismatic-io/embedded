export interface PrismaticConfig {
  /** Prismatic URL. Defaults to US commercial https://app.prismatic.io. Can be overridden for custom domains or other regions */
  prismaticUrl?: string;

  /** The ID of your user (often the same as external_id). This can be a UUID, email address, or another unique identifier */
  sub: string;

  /** The ID of your organization */
  organization: string;

  /** The external ID of the customer */
  customer: string;

  /** The role of the user. "user" is only used for user-level config. Generally, you'll want to use "admin". Defaults to "admin" */
  role?: "admin" | "user";

  /** External ID of the user (often the same as sub) */
  external_id?: string;

  /** Name of the user */
  name?: string;

  /** Signing key for signing JWT access tokens */
  signingKey: string;

  /** The duration for which the generated JWT is valid */
  tokenValidSeconds: number;

  /**
   * Optional Prismatic API refresh token. This can be used to query the Prismatic API from the backend
   * as an organization user. You can generate a refresh token with `prism me:token --type refresh`.
   *
   * See https://prismatic.io/docs/api/api-overview/#querying-prismatics-api-programmatically
   * for documentation
   */
  prismaticRefreshToken?: string;
}
