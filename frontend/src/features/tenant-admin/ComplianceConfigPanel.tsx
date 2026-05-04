import { useCallback, useEffect, useState } from "react";
import {
  fetchComplianceConfig,
  saveComplianceConfig,
  fetchDefaultTdsSections,
  fetchAvailableRiskSignals
} from "@/api/admin";
import { getUserFacingErrorMessage } from "@/lib/common/apiError";
import type { TdsRateEntry, ClientComplianceConfig, RiskSignalDefinition } from "@/types";

const PAN_LEVEL_OPTIONS: Array<{ value: ClientComplianceConfig["panValidationLevel"]; label: string }> = [
  { value: "format", label: "Format only" },
  { value: "format_and_checksum", label: "Format + Checksum" }
];

function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2).replace(/\.?0+$/, "");
}

function percentToBps(pct: string): number {
  const val = parseFloat(pct);
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}

function formatThreshold(minor: number): string {
  return (minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function parseThreshold(display: string): number {
  const cleaned = display.replace(/,/g, "").trim();
  const val = parseFloat(cleaned);
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}

interface ComplianceConfigPanelProps {
  canConfigureCompliance: boolean;
}

export function ComplianceConfigPanel({ canConfigureCompliance }: ComplianceConfigPanelProps) {
  const [config, setConfig] = useState<ClientComplianceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tdsEnabled, setTdsEnabled] = useState(false);
  const [tdsRates, setTdsRates] = useState<TdsRateEntry[]>([]);
  const [tdsSaving, setTdsSaving] = useState(false);
  const [tdsError, setTdsError] = useState<string | null>(null);
  const [tdsSuccess, setTdsSuccess] = useState(false);

  const [panEnabled, setPanEnabled] = useState(false);
  const [panLevel, setPanLevel] = useState<ClientComplianceConfig["panValidationLevel"]>("disabled");
  const [panSaving, setPanSaving] = useState(false);
  const [panError, setPanError] = useState<string | null>(null);
  const [panSuccess, setPanSuccess] = useState(false);

  const [riskEnabled, setRiskEnabled] = useState(false);
  const [activeSignals, setActiveSignals] = useState<string[]>([]);
  const [availableSignals, setAvailableSignals] = useState<RiskSignalDefinition[]>([]);
  const [riskSaving, setRiskSaving] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [riskSuccess, setRiskSuccess] = useState(false);

  const [defaultTdsSections, setDefaultTdsSections] = useState<TdsRateEntry[]>([]);

  const [savedTdsEnabled, setSavedTdsEnabled] = useState(false);
  const [savedTdsRates, setSavedTdsRates] = useState<string>("");
  const [savedPanEnabled, setSavedPanEnabled] = useState(false);
  const [savedPanLevel, setSavedPanLevel] = useState<string>("disabled");
  const [savedRiskEnabled, setSavedRiskEnabled] = useState(false);
  const [savedActiveSignals, setSavedActiveSignals] = useState<string>("");

  const tdsDirty = tdsEnabled !== savedTdsEnabled || JSON.stringify(tdsRates) !== savedTdsRates;
  const panDirty = panEnabled !== savedPanEnabled || panLevel !== savedPanLevel;
  const riskDirty = riskEnabled !== savedRiskEnabled || JSON.stringify(activeSignals) !== savedActiveSignals;

  const [addingSection, setAddingSection] = useState(false);
  const [newSection, setNewSection] = useState<TdsRateEntry>({
    section: "", description: "", rateIndividual: 0, rateCompany: 0, rateNoPan: 2000, threshold: 0, active: true
  });

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [configData, defaults, signals] = await Promise.all([
        fetchComplianceConfig(),
        fetchDefaultTdsSections(),
        fetchAvailableRiskSignals()
      ]);

      setConfig(configData);
      setTdsEnabled(configData.tdsEnabled ?? false);
      setTdsRates(configData.tdsRates?.length > 0 ? configData.tdsRates : defaults);
      setPanEnabled(configData.panValidationEnabled ?? false);
      setPanLevel(configData.panValidationLevel ?? "disabled");
      setRiskEnabled(configData.riskSignalsEnabled ?? false);
      setActiveSignals(configData.activeRiskSignals?.length > 0 ? configData.activeRiskSignals : signals.map((s) => s.code));
      setAvailableSignals(signals);
      setDefaultTdsSections(defaults);

      const effectiveRates = configData.tdsRates?.length > 0 ? configData.tdsRates : defaults;
      const effectiveSignals = configData.activeRiskSignals?.length > 0 ? configData.activeRiskSignals : signals.map((s) => s.code);
      setSavedTdsEnabled(configData.tdsEnabled ?? false);
      setSavedTdsRates(JSON.stringify(effectiveRates));
      setSavedPanEnabled(configData.panValidationEnabled ?? false);
      setSavedPanLevel(configData.panValidationLevel ?? "disabled");
      setSavedRiskEnabled(configData.riskSignalsEnabled ?? false);
      setSavedActiveSignals(JSON.stringify(effectiveSignals));
    } catch (err) {
      setLoadError(getUserFacingErrorMessage(err, "Failed to load compliance configuration."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSaveTds = useCallback(async () => {
    setTdsError(null);
    setTdsSuccess(false);
    setTdsSaving(true);
    try {
      const updated = await saveComplianceConfig({ tdsEnabled, tdsRates });
      setConfig(updated);
      setTdsRates(updated.tdsRates);
      setSavedTdsEnabled(tdsEnabled);
      setSavedTdsRates(JSON.stringify(updated.tdsRates));
      setTdsSuccess(true);
      setTimeout(() => setTdsSuccess(false), 3000);
    } catch (err) {
      setTdsError(getUserFacingErrorMessage(err, "Failed to save TDS configuration."));
    } finally {
      setTdsSaving(false);
    }
  }, [tdsEnabled, tdsRates]);

  const handleSavePan = useCallback(async () => {
    setPanError(null);
    setPanSuccess(false);
    setPanSaving(true);
    try {
      const effectiveLevel = panEnabled ? panLevel : "disabled";
      const updated = await saveComplianceConfig({
        panValidationEnabled: panEnabled,
        panValidationLevel: effectiveLevel
      });
      setConfig(updated);
      setSavedPanEnabled(panEnabled);
      setSavedPanLevel(effectiveLevel);
      setPanSuccess(true);
      setTimeout(() => setPanSuccess(false), 3000);
    } catch (err) {
      setPanError(getUserFacingErrorMessage(err, "Failed to save PAN validation settings."));
    } finally {
      setPanSaving(false);
    }
  }, [panEnabled, panLevel]);

  const handleSaveRisk = useCallback(async () => {
    setRiskError(null);
    setRiskSuccess(false);
    setRiskSaving(true);
    try {
      const updated = await saveComplianceConfig({
        riskSignalsEnabled: riskEnabled,
        activeRiskSignals: activeSignals
      });
      setConfig(updated);
      setSavedRiskEnabled(riskEnabled);
      setSavedActiveSignals(JSON.stringify(activeSignals));
      setRiskSuccess(true);
      setTimeout(() => setRiskSuccess(false), 3000);
    } catch (err) {
      setRiskError(getUserFacingErrorMessage(err, "Failed to save risk signal settings."));
    } finally {
      setRiskSaving(false);
    }
  }, [riskEnabled, activeSignals]);

  const updateTdsRate = useCallback((index: number, field: keyof TdsRateEntry, value: unknown) => {
    setTdsRates((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }, []);

  const removeTdsRate = useCallback((index: number) => {
    setTdsRates((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddSection = useCallback(() => {
    if (!newSection.section.trim() || !newSection.description.trim()) return;
    setTdsRates((prev) => [...prev, { ...newSection }]);
    setNewSection({ section: "", description: "", rateIndividual: 0, rateCompany: 0, rateNoPan: 2000, threshold: 0, active: true });
    setAddingSection(false);
  }, [newSection]);

  const resetToDefaults = useCallback(() => {
    setTdsRates([...defaultTdsSections]);
  }, [defaultTdsSections]);

  const toggleSignal = useCallback((code: string) => {
    setActiveSignals((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }, []);

  if (!canConfigureCompliance) return null;

  if (loading) {
    return (
      <div className="editor-card tenant-config-section-spacer">
        <p className="tenant-config-loading">Loading compliance configuration...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="editor-card tenant-config-section-spacer">
        <p className="tenant-config-error-text">{loadError}</p>
        <button type="button" className="app-button app-button-secondary" onClick={loadConfig}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <div className="editor-card tenant-config-section-spacer">
        <div className="editor-header">
          <h3>TDS Configuration</h3>
        </div>

        <div className="tenant-config-toggle-row">
          <label className="toggle-switch">
            <input type="checkbox" checked={tdsEnabled} onChange={(e) => setTdsEnabled(e.target.checked)} disabled={tdsSaving} />
            <span className="toggle-track" />
          </label>
          <span className="tenant-config-toggle-label">TDS Calculation Enabled</span>
        </div>

        {tdsEnabled ? (
          <>
            <div className="list-scroll tenant-config-field-spacer">
              <table>
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Description</th>
                    <th>Rate (Individual)</th>
                    <th>Rate (Company)</th>
                    <th>Rate (No PAN)</th>
                    <th>Threshold (INR)</th>
                    <th>Active</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tdsRates.map((rate, idx) => (
                    <tr key={rate.section + idx}>
                      <td className="compliance-config-section-cell">{rate.section}</td>
                      <td>
                        <input
                          type="text"
                          value={rate.description}
                          onChange={(e) => updateTdsRate(idx, "description", e.target.value)}
                          disabled={tdsSaving}
                          className="compliance-config-rate-cell"
                        />
                      </td>
                      <td>
                        <div className="tenant-config-field-row">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={bpsToPercent(rate.rateIndividual)}
                            onChange={(e) => updateTdsRate(idx, "rateIndividual", percentToBps(e.target.value))}
                            disabled={tdsSaving}
                            className="tenant-config-field-input-num"
                          />
                          <span className="tenant-config-field-suffix">%</span>
                        </div>
                      </td>
                      <td>
                        <div className="tenant-config-field-row">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={bpsToPercent(rate.rateCompany)}
                            onChange={(e) => updateTdsRate(idx, "rateCompany", percentToBps(e.target.value))}
                            disabled={tdsSaving}
                            className="tenant-config-field-input-num"
                          />
                          <span className="tenant-config-field-suffix">%</span>
                        </div>
                      </td>
                      <td>
                        <div className="tenant-config-field-row">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={bpsToPercent(rate.rateNoPan)}
                            onChange={(e) => updateTdsRate(idx, "rateNoPan", percentToBps(e.target.value))}
                            disabled={tdsSaving}
                            className="tenant-config-field-input-num"
                          />
                          <span className="tenant-config-field-suffix">%</span>
                        </div>
                      </td>
                      <td>
                        <div className="tenant-config-field-row">
                          <span className="tenant-config-field-suffix">INR</span>
                          <input
                            type="text"
                            value={formatThreshold(rate.threshold)}
                            onChange={(e) => updateTdsRate(idx, "threshold", parseThreshold(e.target.value))}
                            disabled={tdsSaving}
                            className="tenant-config-field-input-money"
                          />
                        </div>
                      </td>
                      <td>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={rate.active}
                            onChange={(e) => updateTdsRate(idx, "active", e.target.checked)}
                            disabled={tdsSaving}
                          />
                          <span className="toggle-track" />
                        </label>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="app-button app-button-secondary app-button-sm"
                          onClick={() => removeTdsRate(idx)}
                          disabled={tdsSaving}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {addingSection ? (
              <div className="compliance-config-add-section-card">
                <div className="compliance-config-add-section-grid-2">
                  <label className="tenant-config-field">
                    Section
                    <input
                      type="text"
                      value={newSection.section}
                      onChange={(e) => setNewSection((p) => ({ ...p, section: e.target.value.toUpperCase() }))}
                      placeholder="e.g. 194K"
                      className="compliance-config-add-section-input"
                    />
                  </label>
                  <label className="tenant-config-field">
                    Description
                    <input
                      type="text"
                      value={newSection.description}
                      onChange={(e) => setNewSection((p) => ({ ...p, description: e.target.value }))}
                      placeholder="e.g. Payment type"
                      className="compliance-config-add-section-input"
                    />
                  </label>
                </div>
                <div className="compliance-config-add-section-grid-4">
                  <label className="tenant-config-field">
                    Rate Individual (%)
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={bpsToPercent(newSection.rateIndividual)}
                      onChange={(e) => setNewSection((p) => ({ ...p, rateIndividual: percentToBps(e.target.value) }))}
                      className="compliance-config-add-section-input"
                    />
                  </label>
                  <label className="tenant-config-field">
                    Rate Company (%)
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={bpsToPercent(newSection.rateCompany)}
                      onChange={(e) => setNewSection((p) => ({ ...p, rateCompany: percentToBps(e.target.value) }))}
                      className="compliance-config-add-section-input"
                    />
                  </label>
                  <label className="tenant-config-field">
                    Rate No PAN (%)
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={bpsToPercent(newSection.rateNoPan)}
                      onChange={(e) => setNewSection((p) => ({ ...p, rateNoPan: percentToBps(e.target.value) }))}
                      className="compliance-config-add-section-input"
                    />
                  </label>
                  <label className="tenant-config-field">
                    Threshold (INR)
                    <input
                      type="text"
                      value={formatThreshold(newSection.threshold)}
                      onChange={(e) => setNewSection((p) => ({ ...p, threshold: parseThreshold(e.target.value) }))}
                      className="compliance-config-add-section-input"
                    />
                  </label>
                </div>
                <div className="compliance-config-add-section-actions">
                  <button type="button" className="app-button app-button-primary app-button-sm" onClick={handleAddSection}>
                    Add
                  </button>
                  <button type="button" className="app-button app-button-secondary app-button-sm" onClick={() => setAddingSection(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="tenant-config-actions-row">
              <button
                type="button"
                className="app-button app-button-secondary app-button-sm"
                onClick={() => setAddingSection(true)}
                disabled={tdsSaving || addingSection}
              >
                Add Section
              </button>
              <button
                type="button"
                className="app-button app-button-secondary app-button-sm"
                onClick={resetToDefaults}
                disabled={tdsSaving}
              >
                Reset to Defaults
              </button>
            </div>
          </>
        ) : null}

        {tdsError ? (
          <p className="tenant-config-status-error">{tdsError}</p>
        ) : null}
        {tdsSuccess ? (
          <p className="tenant-config-status-success">TDS configuration saved.</p>
        ) : null}

        {tdsDirty ? (
          <div className="tenant-config-save-bar">
            <button type="button" className="app-button app-button-primary" onClick={handleSaveTds} disabled={tdsSaving}>
              {tdsSaving ? "Saving..." : "Save TDS Config"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="editor-card tenant-config-section-spacer">
        <div className="editor-header">
          <h3>PAN Validation</h3>
        </div>

        <div className="tenant-config-toggle-row">
          <label className="toggle-switch">
            <input type="checkbox" checked={panEnabled} onChange={(e) => setPanEnabled(e.target.checked)} disabled={panSaving} />
            <span className="toggle-track" />
          </label>
          <span className="tenant-config-toggle-label">PAN Validation Enabled</span>
        </div>

        {panEnabled ? (
          <div className="tenant-config-field-spacer">
            <label className="tenant-config-field">
              Validation Level
              <select
                value={panLevel}
                onChange={(e) => setPanLevel(e.target.value as ClientComplianceConfig["panValidationLevel"])}
                disabled={panSaving}
                className="tenant-config-field-input-medium"
              >
                {PAN_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {panError ? (
          <p className="tenant-config-status-error">{panError}</p>
        ) : null}
        {panSuccess ? (
          <p className="tenant-config-status-success">PAN validation settings saved.</p>
        ) : null}

        {panDirty ? (
          <div className="tenant-config-save-bar">
            <button type="button" className="app-button app-button-primary" onClick={handleSavePan} disabled={panSaving}>
              {panSaving ? "Saving..." : "Save PAN Settings"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="editor-card tenant-config-section-spacer">
        <div className="editor-header">
          <h3>Risk Signals</h3>
        </div>

        <div className="tenant-config-toggle-row">
          <label className="toggle-switch">
            <input type="checkbox" checked={riskEnabled} onChange={(e) => setRiskEnabled(e.target.checked)} disabled={riskSaving} />
            <span className="toggle-track" />
          </label>
          <span className="tenant-config-toggle-label">Risk Signal Evaluation Enabled</span>
        </div>

        {riskEnabled ? (
          <div className="compliance-config-signal-list">
            {availableSignals.map((signal) => (
              <label key={signal.code} className="compliance-config-signal-row">
                <input
                  type="checkbox"
                  checked={activeSignals.includes(signal.code)}
                  onChange={() => toggleSignal(signal.code)}
                  disabled={riskSaving}
                />
                <span>
                  <span className="compliance-config-signal-name">{signal.code.replace(/_/g, " ")}</span>
                  <span className="compliance-config-signal-meta">
                    {signal.description}
                    <span className="compliance-config-signal-category">
                      {signal.category}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : null}

        {riskError ? (
          <p className="tenant-config-status-error">{riskError}</p>
        ) : null}
        {riskSuccess ? (
          <p className="tenant-config-status-success">Risk signal settings saved.</p>
        ) : null}

        {riskDirty ? (
          <div className="tenant-config-save-bar">
            <button type="button" className="app-button app-button-primary" onClick={handleSaveRisk} disabled={riskSaving}>
              {riskSaving ? "Saving..." : "Save Risk Signal Settings"}
            </button>
          </div>
        ) : null}
      </div>

      {config?.updatedBy ? (
        <p className="tenant-config-meta">
          Last updated by {config.updatedBy}
          {config.updatedAt ? ` on ${new Date(config.updatedAt).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
        </p>
      ) : null}
    </>
  );
}
