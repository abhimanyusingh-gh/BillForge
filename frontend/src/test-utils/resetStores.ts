import { useActiveRealmStore } from "@/stores/activeRealmStore";

export function resetStores(): void {
  useActiveRealmStore.setState({ id: null });
}
