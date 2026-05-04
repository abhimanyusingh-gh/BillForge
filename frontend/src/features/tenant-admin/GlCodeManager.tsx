import { useState, useEffect, useCallback, useRef } from "react";
import type { GlCode } from "@/types";
import { fetchGlCodes as fetchGlCodesApi, createGlCode, deleteGlCode } from "@/api";
import { importGlCodesCsv } from "@/api/admin";
import type { GlCodeImportResult } from "@/api/admin";

const GL_CATEGORIES = [
  "Office Expenses", "Professional Services", "Rent", "Utilities", "Travel",
  "Contractor Services", "Raw Materials", "Commission", "Insurance",
  "Repairs & Maintenance", "Other"
];

const CSV_TEMPLATE = "code,name,category,tdsSection,costCenter\n4001,Office Rent,Rent,194I,CC-ADMIN\n4002,Legal & Professional Fees,Professional Services,194J,CC-LEGAL\n";

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
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<GlCodeImportResult | null>(null);
  const [showImportErrors, setShowImportErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportResult(null);
    setShowImportErrors(false);
    setImporting(true);

    try {
      const result = await importGlCodesCsv(file);
      setImportResult(result);
      if (result.imported > 0) {
        await loadGlCodes();
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err as { message?: string })?.message
        ?? "CSV import failed.";
      setError(msg);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gl-codes-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBannerClass = importResult && importResult.errors.length > 0
    ? "gl-code-import-banner gl-code-import-banner-warn"
    : "gl-code-import-banner";

  return (
    <div>
      <div className="gl-code-toolbar">
        <input
          type="text"
          placeholder="Search GL codes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="gl-code-search-input"
        />
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="gl-code-toolbar-btn"
        >
          {showAdd ? "Cancel" : "Add"}
        </button>
        <button
          onClick={handleImportClick}
          disabled={importing}
          className="gl-code-toolbar-btn"
        >
          {importing ? "Importing..." : "Import CSV"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          hidden
        />
        <button
          onClick={handleDownloadTemplate}
          className="gl-code-template-btn"
        >
          Download Template
        </button>
      </div>

      {error && <div className="gl-code-error-text">{error}</div>}

      {importResult && (
        <div className={importBannerClass}>
          <div className="gl-code-import-summary">
            Import complete: {importResult.imported} imported, {importResult.skipped} skipped
            {importResult.errors.length > 0 && `, ${importResult.errors.length} error${importResult.errors.length === 1 ? "" : "s"}`}.
          </div>
          {importResult.errors.length > 0 && (
            <div>
              <button
                onClick={() => setShowImportErrors(!showImportErrors)}
                className="gl-code-import-toggle-errors"
              >
                {showImportErrors ? "Hide errors" : "Show errors"}
              </button>
              {showImportErrors && (
                <ul className="gl-code-import-error-list">
                  {importResult.errors.map((e: { row: number; message: string }, i: number) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="gl-code-add-row">
          <input placeholder="Code" value={newCode} onChange={(e) => setNewCode(e.target.value)} className="gl-code-add-input gl-code-add-input-code" />
          <input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="gl-code-add-input gl-code-add-input-name" />
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="gl-code-add-input">
            {GL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="TDS Section (optional)" value={newLinkedTds} onChange={(e) => setNewLinkedTds(e.target.value)} className="gl-code-add-input gl-code-add-input-tds" />
          <button onClick={handleAdd} className="gl-code-add-save">Save</button>
        </div>
      )}

      {loading ? (
        <div className="gl-code-empty">Loading...</div>
      ) : glCodes.length === 0 ? (
        <div className="gl-code-empty">No GL codes configured. Add one or import from CSV.</div>
      ) : (
        <table className="gl-code-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>TDS</th>
              <th className="gl-code-action-cell"></th>
            </tr>
          </thead>
          <tbody>
            {glCodes.map((gl) => (
              <tr key={gl.code} className={gl.isActive ? undefined : "gl-code-row-inactive"}>
                <td className="gl-code-cell-mono">{gl.code}</td>
                <td>{gl.name}</td>
                <td>{gl.category}</td>
                <td>{gl.linkedTdsSection ?? "—"}</td>
                <td className="gl-code-action-cell">
                  {gl.isActive && (
                    <button
                      onClick={() => handleDelete(gl.code)}
                      className="gl-code-remove-btn"
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
