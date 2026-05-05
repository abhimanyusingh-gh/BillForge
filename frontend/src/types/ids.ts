export type UserId = string & { readonly __brand: "UserId" };
export type TenantId = string & { readonly __brand: "TenantId" };
export type ClientOrgId = string & { readonly __brand: "ClientOrgId" };

export function asUserId(value: string): UserId {
  return value as UserId;
}

export function asTenantId(value: string): TenantId {
  return value as TenantId;
}

export function asClientOrgId(value: string): ClientOrgId {
  return value as ClientOrgId;
}
