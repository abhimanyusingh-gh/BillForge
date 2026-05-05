import { useSessionStore } from "@/state/sessionStore";
import type { ClientOrgId, TenantId } from "@/types/ids";

export interface BankContext {
  tenantId: TenantId;
  clientOrgId: ClientOrgId;
}

export function useBankContext(): BankContext | null {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  if (tenantId === null || clientOrgId === null) return null;
  return { tenantId, clientOrgId };
}

export function formatInr(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "—";
  const rupees = minor / 100;
  return rupees.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatPeriod(from: string | null, to: string | null): string {
  if (!from && !to) return "—";
  return `${formatDate(from)} – ${formatDate(to)}`;
}
