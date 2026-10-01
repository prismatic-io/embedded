import type {
  CreateInstancePermission,
  Instance,
  CreateInstancePermissionReason,
  MarketplaceIntegrationError,
  MarketplaceIntegrationResource,
  Permission,
  PrismaticError,
  Resource,
  Result,
} from "./index.js";

const checkResource = (resource: MarketplaceIntegrationResource) => {
  const completion: Promise<Result<void, MarketplaceIntegrationError>> =
    resource.actions.refresh.execute();
  // @ts-expect-error Refresh uses the common Action contract.
  resource.actions.refresh();
  const created: Promise<Result<Instance, MarketplaceIntegrationError>> =
    resource.actions.createInstance.execute({ name: "Orders" });
  // @ts-expect-error A new instance needs a name.
  resource.actions.createInstance.execute({});
  // @ts-expect-error Permissions belong to data, never to the resource wrapper.
  resource.permissions;
  if (resource.status === "success") {
    const id: string = resource.data.id;
    const permission = resource.data.permissions.createInstance;
    const allowed: boolean = permission.allowed;
    const reason: string | null = permission.reason;
    if (permission.allowed) {
      const allowedReason: null = permission.reason;
      void allowedReason;
    } else {
      const deniedReason: string = permission.reason;
      void deniedReason;
    }
    const refreshing: boolean = resource.isRefreshing;
    // @ts-expect-error Errors exist only on the error branch.
    resource.error;
    return { id, allowed, reason, refreshing, completion, created };
  }
  // @ts-expect-error Permissions do not exist before success.
  resource.data.permissions;
  // @ts-expect-error Data does not exist before success.
  resource.data;
  if (resource.status === "error") {
    const refreshing: boolean = resource.isRefreshing;
    const error: PrismaticError = resource.error;
    if (resource.error.code === "PRISMATIC_MARKETPLACE_INTEGRATION_NOT_FOUND") {
      return { error, refreshing };
    }
  } else {
    const loading: "loading" = resource.status;
    // @ts-expect-error Initial loading has no refresh progress.
    resource.isRefreshing;
    // @ts-expect-error Loading has no error.
    resource.error;
    return loading;
  }
};

const defaultResource: Resource<string> = {
  status: "success",
  data: "value",
  actions: {},
  isRefreshing: false,
};

// @ts-expect-error A resource error must satisfy PrismaticError.
export type InvalidError = Resource<string, Error>;

// @ts-expect-error A denied permission requires a reason.
const missingReason: Permission = { allowed: false, reason: null };
// @ts-expect-error An allowed permission has no denial reason.
const unexpectedReason: Permission = { allowed: true, reason: "Denied" };

const knownReason: CreateInstancePermissionReason = "INSTANCE_EXISTS";
const futureReason: CreateInstancePermissionReason = "FUTURE_POLICY";
const denied: CreateInstancePermission = {
  allowed: false,
  reason: futureReason,
};
// @ts-expect-error Permission reasons remain strings.
const invalidReason: CreateInstancePermissionReason = 42;
// @ts-expect-error A denied create-instance permission requires a reason.
const missingCreateReason: CreateInstancePermission = {
  allowed: false,
  reason: null,
};

void checkResource;
void defaultResource;
void missingReason;
void unexpectedReason;
void knownReason;
void denied;
void invalidReason;
void missingCreateReason;
