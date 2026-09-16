import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as realApi from "../../lib/realApi";
import { RepoConnect } from "./RepoConnect";

vi.mock("../../lib/realApi", () => ({
  validateRepoPath: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("RepoConnect", () => {
  it("shows the demo-repo state by default", () => {
    render(
      <RepoConnect connectedRepo={null} onConnect={vi.fn()} onDisconnect={vi.fn()} disabled={false} />,
    );

    expect(screen.getByText("Working in the throwaway demo repo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect a real repository" })).toBeEnabled();
  });

  it("disables the connect action when the backend is unavailable", () => {
    render(
      <RepoConnect connectedRepo={null} onConnect={vi.fn()} onDisconnect={vi.fn()} disabled={true} />,
    );

    expect(screen.getByRole("button", { name: "Connect a real repository" })).toBeDisabled();
  });

  it("shows the connected state with the repo's name", () => {
    render(
      <RepoConnect
        connectedRepo={{ path: "/tmp/x", name: "my-repo", isGitRepo: true }}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByText("my-repo")).toBeInTheDocument();
    expect(screen.queryByText(/not a git repo/)).not.toBeInTheDocument();
  });

  it("flags a connected repo that isn't a git repo", () => {
    render(
      <RepoConnect
        connectedRepo={{ path: "/tmp/x", name: "my-repo", isGitRepo: false }}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByText(/\(not a git repo\)/)).toBeInTheDocument();
  });

  it("calls onDisconnect when 'Use demo repo instead' is clicked", async () => {
    const onDisconnect = vi.fn();
    const user = userEvent.setup();
    render(
      <RepoConnect
        connectedRepo={{ path: "/tmp/x", name: "my-repo", isGitRepo: true }}
        onConnect={vi.fn()}
        onDisconnect={onDisconnect}
        disabled={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Use demo repo instead" }));

    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it("opens the path editor and connects on a valid path", async () => {
    vi.mocked(realApi.validateRepoPath).mockResolvedValue({
      valid: true,
      name: "my-repo",
      isGitRepo: true,
    });
    const onConnect = vi.fn();
    const user = userEvent.setup();
    render(
      <RepoConnect connectedRepo={null} onConnect={onConnect} onDisconnect={vi.fn()} disabled={false} />,
    );

    await user.click(screen.getByRole("button", { name: "Connect a real repository" }));
    await user.type(screen.getByPlaceholderText("/absolute/path/to/your/repo"), "/tmp/my-repo");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() =>
      expect(onConnect).toHaveBeenCalledWith({ path: "/tmp/my-repo", name: "my-repo", isGitRepo: true }),
    );
  });

  it("shows the backend's error inline on an invalid path, without calling onConnect", async () => {
    vi.mocked(realApi.validateRepoPath).mockResolvedValue({
      valid: false,
      error: "No such path: /nope",
    });
    const onConnect = vi.fn();
    const user = userEvent.setup();
    render(
      <RepoConnect connectedRepo={null} onConnect={onConnect} onDisconnect={vi.fn()} disabled={false} />,
    );

    await user.click(screen.getByRole("button", { name: "Connect a real repository" }));
    await user.type(screen.getByPlaceholderText("/absolute/path/to/your/repo"), "/nope");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(screen.getByText("No such path: /nope")).toBeInTheDocument());
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("does not call validateRepoPath for a blank path", async () => {
    const user = userEvent.setup();
    render(
      <RepoConnect connectedRepo={null} onConnect={vi.fn()} onDisconnect={vi.fn()} disabled={false} />,
    );

    await user.click(screen.getByRole("button", { name: "Connect a real repository" }));
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(realApi.validateRepoPath).not.toHaveBeenCalled();
  });

  it("cancels back to the demo-repo state without validating", async () => {
    const user = userEvent.setup();
    render(
      <RepoConnect connectedRepo={null} onConnect={vi.fn()} onDisconnect={vi.fn()} disabled={false} />,
    );

    await user.click(screen.getByRole("button", { name: "Connect a real repository" }));
    await user.type(screen.getByPlaceholderText("/absolute/path/to/your/repo"), "/tmp/x");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Working in the throwaway demo repo")).toBeInTheDocument();
    expect(realApi.validateRepoPath).not.toHaveBeenCalled();
  });

  it("connects on pressing Enter in the path field", async () => {
    vi.mocked(realApi.validateRepoPath).mockResolvedValue({ valid: true, name: "x", isGitRepo: false });
    const onConnect = vi.fn();
    const user = userEvent.setup();
    render(
      <RepoConnect connectedRepo={null} onConnect={onConnect} onDisconnect={vi.fn()} disabled={false} />,
    );

    await user.click(screen.getByRole("button", { name: "Connect a real repository" }));
    await user.type(screen.getByPlaceholderText("/absolute/path/to/your/repo"), "/tmp/x{Enter}");

    await waitFor(() => expect(onConnect).toHaveBeenCalledOnce());
  });
});
