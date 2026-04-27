import { useAuthStore } from "@/stores/authStore";

export { TENANT_SETUP_COMPLETED_STORAGE_KEY } from "@/stores/authStore";

export function writeTenantSetupCompleted(completed: boolean): void {
  useAuthStore.getState().setTenantSetupCompleted(completed);
}

export function useTenantSetupCompleted(): boolean {
  return useAuthStore((s) => s.tenantSetupCompleted);
}
