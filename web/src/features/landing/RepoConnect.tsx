import { useState } from "react";
import { Button } from "../../components/Button";
import { CloseIcon, FolderIcon } from "../../components/icons";
import { validateRepoPath } from "../../lib/realApi";
import type { ConnectedRepo } from "../../lib/types";
import styles from "./RepoConnect.module.css";

interface RepoConnectProps {
  connectedRepo: ConnectedRepo | null;
  onConnect: (repo: ConnectedRepo) => void;
  onDisconnect: () => void;
  disabled: boolean;
}

/** Lets the user point the agent at a real local repo instead of the
 * throwaway demo copy. There's no browser API that turns a folder pick
 * into a filesystem path the backend can open, so this is a path the user
 * types in, validated against the backend before it's accepted. */
export function RepoConnect({ connectedRepo, onConnect, onDisconnect, disabled }: RepoConnectProps) {
  const [editing, setEditing] = useState(false);
  const [path, setPath] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setEditing(false);
    setPath("");
    setError(null);
  }

  async function handleConnect() {
    const trimmed = path.trim();
    if (!trimmed || checking) return;
    setChecking(true);
    setError(null);
    const result = await validateRepoPath(trimmed);
    setChecking(false);
    if (!result.valid) {
      setError(result.error ?? "That path could not be used.");
      return;
    }
    onConnect({ path: trimmed, name: result.name ?? trimmed, isGitRepo: !!result.isGitRepo });
    setEditing(false);
    setPath("");
  }

  if (editing) {
    return (
      <div className={styles.wrap}>
        <div className={styles.editRow}>
          <input
            autoFocus
            type="text"
            className={styles.input}
            placeholder="/absolute/path/to/your/repo"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConnect();
              if (e.key === "Escape") cancel();
            }}
            spellCheck={false}
            autoComplete="off"
          />
          <Button variant="secondary" size="md" onClick={handleConnect} loading={checking}>
            Connect
          </Button>
          <button type="button" className={styles.iconButton} onClick={cancel} aria-label="Cancel">
            <CloseIcon size={12} />
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <p className={styles.hint}>
          The agent edits this repo in place — no throwaway copy is made, unlike the demo.
        </p>
      </div>
    );
  }

  if (connectedRepo) {
    return (
      <div className={styles.row}>
        <FolderIcon size={13} className={styles.icon} />
        <span className={styles.label}>
          Working in <strong>{connectedRepo.name}</strong>
          {!connectedRepo.isGitRepo && " (not a git repo)"}
        </span>
        <button type="button" className={styles.linkButton} onClick={onDisconnect}>
          Use demo repo instead
        </button>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <FolderIcon size={13} className={styles.icon} />
      <span className={styles.label}>Working in the throwaway demo repo</span>
      <button
        type="button"
        className={styles.linkButton}
        onClick={() => setEditing(true)}
        disabled={disabled}
        title={disabled ? "Connect the backend to use a real repository." : undefined}
      >
        Connect a real repository
      </button>
    </div>
  );
}
