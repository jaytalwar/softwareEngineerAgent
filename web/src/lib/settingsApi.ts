import { API_BASE } from "./realApi";

export interface Settings {
  hasApiKey: boolean;
  model: string;
  maxIterations: number;
  availableModels: string[];
}

interface RawSettings {
  has_api_key: boolean;
  model: string;
  max_iterations: number;
  available_models: string[];
}

function fromRaw(raw: RawSettings): Settings {
  return {
    hasApiKey: raw.has_api_key,
    model: raw.model,
    maxIterations: raw.max_iterations,
    availableModels: raw.available_models,
  };
}

export async function getSettings(): Promise<Settings | null> {
  try {
    const res = await fetch(`${API_BASE}/api/settings`);
    if (!res.ok) return null;
    return fromRaw(await res.json());
  } catch {
    return null;
  }
}

export interface SettingsUpdate {
  /** Omit to leave unchanged, "" to clear it, a value to set it. Never
   * echoed back by the server — only whether one is configured. */
  apiKey?: string;
  model?: string;
  maxIterations?: number;
}

export async function updateSettings(update: SettingsUpdate): Promise<Settings | null> {
  try {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: update.apiKey,
        model: update.model,
        max_iterations: update.maxIterations,
      }),
    });
    if (!res.ok) return null;
    return fromRaw(await res.json());
  } catch {
    return null;
  }
}
