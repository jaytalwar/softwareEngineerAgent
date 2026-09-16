import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as settingsApi from "../lib/settingsApi";
import { SettingsModal } from "./SettingsModal";

vi.mock("../lib/settingsApi", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

const SETTINGS: settingsApi.Settings = {
  hasApiKey: false,
  model: "claude-sonnet-5",
  maxIterations: 20,
  availableModels: ["claude-sonnet-5", "claude-opus-5"],
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("SettingsModal", () => {
  it("loads and displays the current settings", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue(SETTINGS);

    render(<SettingsModal onClose={vi.fn()} />);

    expect(await screen.findByDisplayValue("claude-sonnet-5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20")).toBeInTheDocument();
    expect(
      screen.getByText("No key configured — tasks run against the scripted fallback (no cost, no real reasoning)."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("shows a load error when the backend is unreachable", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue(null);

    render(<SettingsModal onClose={vi.fn()} />);

    expect(await screen.findByText(/Backend not reachable/)).toBeInTheDocument();
  });

  it("shows the configured-key hint and a Clear button when a key is set", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue({ ...SETTINGS, hasApiKey: true });

    render(<SettingsModal onClose={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.getByText(/A key is configured/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/configured/)).toBeInTheDocument();
  });

  it("calls onClose on Escape", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue(SETTINGS);
    const onClose = vi.fn();
    render(<SettingsModal onClose={onClose} />);
    await screen.findByDisplayValue("claude-sonnet-5");

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking the close button", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue(SETTINGS);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SettingsModal onClose={onClose} />);
    await screen.findByDisplayValue("claude-sonnet-5");

    await user.click(screen.getByRole("button", { name: "Close settings" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking the scrim, but not the modal body", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue(SETTINGS);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SettingsModal onClose={onClose} />);
    await screen.findByDisplayValue("claude-sonnet-5");

    await user.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("saves the model and max iterations without an api key when none was typed", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue(SETTINGS);
    vi.mocked(settingsApi.updateSettings).mockResolvedValue({ ...SETTINGS, model: "claude-opus-5" });
    const user = userEvent.setup();
    render(<SettingsModal onClose={vi.fn()} />);
    await screen.findByDisplayValue("claude-sonnet-5");

    await user.selectOptions(screen.getByDisplayValue("claude-sonnet-5"), "claude-opus-5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(settingsApi.updateSettings).toHaveBeenCalledWith({
        model: "claude-opus-5",
        maxIterations: 20,
      }),
    );
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("includes the typed api key when saving, then clears the input", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue(SETTINGS);
    vi.mocked(settingsApi.updateSettings).mockResolvedValue({ ...SETTINGS, hasApiKey: true });
    const user = userEvent.setup();
    render(<SettingsModal onClose={vi.fn()} />);
    await screen.findByDisplayValue("claude-sonnet-5");

    const keyInput = screen.getByPlaceholderText("sk-ant-...");
    await user.type(keyInput, "sk-ant-test-key");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(settingsApi.updateSettings).toHaveBeenCalledWith({
        model: "claude-sonnet-5",
        maxIterations: 20,
        apiKey: "sk-ant-test-key",
      }),
    );
    await waitFor(() => expect(keyInput).toHaveValue(""));
  });

  it("clears the key via the Clear button", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue({ ...SETTINGS, hasApiKey: true });
    vi.mocked(settingsApi.updateSettings).mockResolvedValue({ ...SETTINGS, hasApiKey: false });
    const user = userEvent.setup();
    render(<SettingsModal onClose={vi.fn()} />);
    await screen.findByRole("button", { name: "Clear" });

    await user.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => expect(settingsApi.updateSettings).toHaveBeenCalledWith({ apiKey: "" }));
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("does not show 'Saved.' when the save call fails", async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue(SETTINGS);
    vi.mocked(settingsApi.updateSettings).mockResolvedValue(null);
    const user = userEvent.setup();
    render(<SettingsModal onClose={vi.fn()} />);
    await screen.findByDisplayValue("claude-sonnet-5");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(settingsApi.updateSettings).toHaveBeenCalled());
    expect(screen.queryByText("Saved.")).not.toBeInTheDocument();
  });
});
