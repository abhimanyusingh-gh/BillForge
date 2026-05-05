export function MissingClientOrgPopover() {
  const onCta = () => {
    window.location.hash = "#/client-orgs";
  };

  return (
    <div className="scrim" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Create your first client org">
        <h2 className="modal-card-title">No client orgs yet</h2>
        <p className="modal-card-body">
          Create your first one to start ingesting invoices.
        </p>
        <div className="modal-card-actions">
          <button type="button" className="btn-primary" onClick={onCta}>
            Create client org
          </button>
        </div>
      </div>
    </div>
  );
}
