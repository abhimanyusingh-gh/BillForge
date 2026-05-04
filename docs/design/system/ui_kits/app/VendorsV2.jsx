// VendorsV2.jsx — uses NewVendorModal popup
function VendorsV2() {
  const [active, setActive] = React.useState(window.VENDORS[0].name);
  const [newOpen, setNewOpen] = React.useState(false);
  const v = window.VENDORS.find(x => x.name === active) || window.VENDORS[0];
  return (
    <div>
      <div className="page-header">
        <h1>Vendors</h1>
        <span className="count">{window.VENDORS.length} active</span>
        <div className="page-tools">
          <button onClick={() => setNewOpen(true)} style={{ height: 30, padding: "0 12px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 12px var(--font-sans)", cursor: "pointer" }}>+ New vendor</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12 }}>
        <div><window.VendorsTableInner active={active} setActive={setActive} /></div>
        <window.VendorDetailPanel v={v} />
      </div>
      <window.NewVendorModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
window.VendorsV2 = VendorsV2;
