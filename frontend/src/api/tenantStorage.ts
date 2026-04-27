import { useAuthStore } from "@/stores/authStore";

export function readActiveTenantId(): string | null {
  return useAuthStore.getState().activeTenantId;
}

export function writeActiveTenantId(tenantId: string | null): void {
  useAuthStore.getState().setActiveTenantId(tenantId);
}
