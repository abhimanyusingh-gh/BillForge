import { useActiveClientOrg } from "@/hooks/useActiveClientOrg";
import { ClientOrgPicker } from "@/features/triage/ClientOrgPicker";
import type { ClientOrgOption } from "@/components/workspace/HierarchyBadges";

interface RealmSwitcherProps {
  open: boolean;
  onClose: () => void;
  clientOrgs: ClientOrgOption[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onGoToOnboarding?: () => void;
}

export function RealmSwitcher({
  open,
  onClose,
  clientOrgs,
  isLoading,
  isError,
  onRetry,
  onGoToOnboarding
}: RealmSwitcherProps) {
  const { activeClientOrgId, setActiveClientOrg } = useActiveClientOrg();

  function handleSelect(option: ClientOrgOption) {
    setActiveClientOrg(option.id);
    onClose();
  }

  return (
    <ClientOrgPicker
      open={open}
      onClose={onClose}
      onSelect={handleSelect}
      clientOrgs={clientOrgs}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      activeClientOrgId={activeClientOrgId}
      title="Switch client organization"
      placeholder="Search by company name..."
      onGoToOnboarding={onGoToOnboarding}
      testIdPrefix="realm-switcher"
    />
  );
}
