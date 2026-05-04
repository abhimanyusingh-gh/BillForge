export function TallyBridgeStatusStrip() {
  return (
    <section className="tally-bridge-strip" data-testid="tally-bridge-strip-placeholder" aria-label="Tally bridge agent status">
      <div className="tally-bridge-icon-wrap" data-state="offline">
        <span className="material-symbols-outlined">cable</span>
        <span className="tally-bridge-pulse" data-state="offline" />
      </div>
      <div>
        <div className="tally-bridge-headline">Bridge agent telemetry coming soon</div>
        <div className="tally-bridge-file">Connect a Tally instance from Setup &rarr; Connections to see live polling status.</div>
        <div className="tally-bridge-meta">
          <span>Live AlterID, F12 settings and last-poll timing arrive with issue #428.</span>
        </div>
      </div>
      <div className="tally-bridge-f12">
        <span className="tally-bridge-f12-label">F12</span>
        <span className="tally-bridge-f12-pill" data-on="false" title="Bill allocations">
          <span className="material-symbols-outlined">help</span>billAlloc
        </span>
        <span className="tally-bridge-f12-pill" data-on="false" title="AlterID export">
          <span className="material-symbols-outlined">help</span>alterIdExport
        </span>
        <span className="tally-bridge-f12-pill" data-on="false" title="GSTIN export">
          <span className="material-symbols-outlined">help</span>gstinExport
        </span>
      </div>
    </section>
  );
}
