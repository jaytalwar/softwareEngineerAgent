import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../components/Button";
import { CloseIcon } from "../components/icons";
import { Skeleton } from "../components/Skeleton";
import { getSettings, updateSettings, type Settings } from "../lib/settingsApi";
import styles from "./SettingsModal.module.css";

interface SettingsModalProps {
  onClose: () => void;
}

/** Mounted/unmounted by its parent (rather than toggling a visibility
 * prop) so every open starts with fresh state — no reset-on-open effect
 * needed. */
export function SettingsModal({ onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [model, setModel] = useState("");
  const [maxIterations, setMaxIterations] = useState(20);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings().then((s) => {
      if (cancelled) return;
      if (!s) {
        setLoadError(true);
        return;
      }
      setSettings(s);
      setModel(s.model);
      setMaxIterations(s.maxIterations);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    const result = await updateSettings({
      model,
      maxIterations,
      ...(apiKeyInput ? { apiKey: apiKeyInput } : {}),
    });
    setSaving(false);
    if (result) {
      setSettings(result);
      setApiKeyInput("");
      setSavedAt(Date.now());
    }
  }

  async function handleClearKey() {
    setSaving(true);
    const result = await updateSettings({ apiKey: "" });
    setSaving(false);
    if (result) {
      setSettings(result);
      setSavedAt(Date.now());
    }
  }

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close settings"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <div className={styles.body}>
          {loadError ? (
            <p className={styles.errorText}>
              Backend not reachable — settings require the API server running at
              localhost:8000.
            </p>
          ) : !settings ? (
            <div className={styles.loadingRows}>
              <Skeleton width="60%" height="1em" />
              <Skeleton width="80%" height="1em" />
              <Skeleton width="40%" height="1em" />
            </div>
          ) : (
            <>
              <Field label="Model">
                <select
                  className={styles.select}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {settings.availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Max Iterations" hint="Default budget for new tasks.">
                <input
                  type="number"
                  min={1}
                  className={styles.numberInput}
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(Number(e.target.value))}
                />
              </Field>

              <Field
                label="Anthropic API Key"
                hint={
                  settings.hasApiKey
                    ? "A key is configured — real Claude calls will be used."
                    : "No key configured — tasks run against the scripted fallback (no cost, no real reasoning)."
                }
              >
                <div className={styles.keyRow}>
                  <input
                    type="password"
                    className={styles.textInput}
                    placeholder={settings.hasApiKey ? "•••••••••••••••• (configured)" : "sk-ant-..."}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    autoComplete="off"
                  />
                  {settings.hasApiKey && (
                    <Button variant="ghost" size="md" onClick={handleClearKey} disabled={saving}>
                      Clear
                    </Button>
                  )}
                </div>
                <p className={styles.keyNote}>
                  Held in this server process&apos;s memory only — never written to disk,
                  never sent back to this UI.
                </p>
              </Field>
            </>
          )}
        </div>

        {!loadError && settings && (
          <div className={styles.footer}>
            <p className={styles.savedNote}>{savedAt ? "Saved." : ""}</p>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
      {hint && <p className={styles.fieldHint}>{hint}</p>}
    </div>
  );
}
