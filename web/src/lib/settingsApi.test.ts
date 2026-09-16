import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE } from "./realApi";
import { getSettings, updateSettings } from "./settingsApi";

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 400, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getSettings", () => {
  it("maps the raw snake_case response to camelCase", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          has_api_key: true,
          model: "claude-sonnet-5",
          max_iterations: 20,
          available_models: ["claude-sonnet-5", "claude-opus-5"],
        }),
      ),
    );

    expect(await getSettings()).toEqual({
      hasApiKey: true,
      model: "claude-sonnet-5",
      maxIterations: 20,
      availableModels: ["claude-sonnet-5", "claude-opus-5"],
    });
  });

  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false)));

    expect(await getSettings()).toBeNull();
  });

  it("returns null when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    expect(await getSettings()).toBeNull();
  });
});

describe("updateSettings", () => {
  it("omits fields that were not given, rather than sending them as null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ has_api_key: false, model: "claude-sonnet-5", max_iterations: 20, available_models: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateSettings({ model: "claude-opus-5" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/settings`);
    expect(JSON.parse(init.body)).toEqual({ model: "claude-opus-5" });
  });

  it("sends an empty string apiKey through as-is (the clear signal)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ has_api_key: false, model: "claude-sonnet-5", max_iterations: 20, available_models: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateSettings({ apiKey: "" });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ api_key: "" });
  });

  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false)));

    expect(await updateSettings({ model: "claude-opus-5" })).toBeNull();
  });

  it("returns null when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    expect(await updateSettings({ model: "claude-opus-5" })).toBeNull();
  });
});
