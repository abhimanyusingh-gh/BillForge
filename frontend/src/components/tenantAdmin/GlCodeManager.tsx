import { useState, useEffect, useCallback } from "react";
import type { GlCode } from "../../types";
import { fetchGlCodes as fetchGlCodesApi, createGlCode, deleteGlCode } from "../../api";

const GL_CATEGORIES = [
  "Office Expenses", "Professional Services", "Rent", "Utilities", "Travel",
  "Contractor Services", "Raw Materials", "Commission", "Insurance",
  "Repairs & Maintenance", "Other"
];

export function GlCodeManager() {
  const [glCodes, setGlCodes] = useState<GlCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Other");
  const [newLinkedTds, setNewLinkedTds] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadGlCodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchGlCodesApi({ search: search || undefined });
      setGlCodes(res.items);
    } catch {
      setError("Failed to load GL codes.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadGlCodes(); }, [loadGlCodes]);

  const handleAdd = async () => {
    if (!newCode.trim() || !newName.trim()) return;
    setError(null);
    try {
      await createGlCode({
        code: newCode.trim(),
        name: newName.trim(),
        category: newCategory,
        linkedTdsSection: newLinkedTds.trim() || undefined
      });
      setNewCode("");
      setNewName("");
      setNewCategory("Other");
      setNewLinkedTds("");
      setShowAdd(false);
      await loadGlCodes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create GL code.";
      setError(msg);
    }
  };

  const handleDelete = async (code: string) => {
    try {
      await deleteGlCode(code);
      await loadGlCodes();
    } catch {
      setError("Failed to delete GL code.");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <input
          type="text"
          placeholder="Search GL codes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: "0.4rem 0.6rem", fontSize: "0.85rem", border: "1px solid var(--border-color, #ccc)", borderRadius: "0.25rem" }}
        />
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem", cursor: "pointer" }}
        >
          {showAdd ? "Cancel" : "Add"}
        </button>
      </div>

      {error && <div style={{ color: "var(--color-error, #ef4444)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{error}</div>}

      {showAdd && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <input placeholder="Code" value={newCode} onChange={(e) => setNewCode(e.target.value)} style={{ width: "5rem", padding: "0.3rem", fontSize: "0.85rem" }} />
          <input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ flex: 1, minWidth: "8rem", padding: "0.3rem", fontSize: "0.85rem" }} />
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ padding: "0.3rem", fontSize: "0.85rem" }}>
            {GL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="TDS Section (optional)" value={newLinkedTds} onChange={(e) => setNewLinkedTds(e.target.value)} style={{ width: "8rem", padding: "0.3rem", fontSize: "0.85rem" }} />
          <button onClick={handleAdd} style={{ padding: "0.3rem 0.75rem", fontSize: "0.85rem", cursor: "pointer" }}>Save</button>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary, #999)" }}>Loading...</div>
      ) : glCodes.length === 0 ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary, #999)" }}>No GL codes configured. Add one or import from CSV.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-color, #e0e0e0)" }}>
              <th style={{ textAlign: "left", padding: "0.4rem 0.25rem" }}>Code</th>
              <th style={{ textAlign: "left", padding: "0.4rem 0.25rem" }}>Name</th>
              <th style={{ textAlign: "left", padding: "0.4rem 0.25rem" }}>Category</th>
              <th style={{ textAlign: "left", padding: "0.4rem 0.25rem" }}>TDS</th>
              <th style={{ textAlign: "center", padding: "0.4rem 0.25rem", width: "4rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {glCodes.map((gl) => (
              <tr key={gl.code} style={{ borderBottom: "1px solid var(--border-color, #f0f0f0)", opacity: gl.isActive ? 1 : 0.5 }}>
                <td style={{ padding: "0.35rem 0.25rem", fontFamily: "monospace" }}>{gl.code}</td>
                <td style={{ padding: "0.35rem 0.25rem" }}>{gl.name}</td>
                <td style={{ padding: "0.35rem 0.25rem" }}>{gl.category}</td>
                <td style={{ padding: "0.35rem 0.25rem" }}>{gl.linkedTdsSection ?? "—"}</td>
                <td style={{ padding: "0.35rem 0.25rem", textAlign: "center" }}>
                  {gl.isActive && (
                    <button
                      onClick={() => handleDelete(gl.code)}
                      style={{ fontSize: "0.75rem", color: "var(--color-error, #ef4444)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
