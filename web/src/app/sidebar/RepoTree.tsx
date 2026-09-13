import { FileIcon, FolderIcon } from "../../components/icons";
import type { RepoNode } from "../../lib/types";
import styles from "./RepoTree.module.css";

interface RepoTreeProps {
  node: RepoNode;
  depth?: number;
  activeFile?: string;
}

export function RepoTree({ node, depth = 0, activeFile }: RepoTreeProps) {
  if (node.type === "file") {
    const isActive = node.path === activeFile;
    return (
      <div
        className={[styles.row, isActive ? styles.active : ""].filter(Boolean).join(" ")}
        style={{ paddingLeft: 12 + depth * 14 }}
      >
        <FileIcon size={13} className={styles.icon} />
        <span className={styles.name}>{node.name}</span>
      </div>
    );
  }

  return (
    <div>
      {depth > 0 && (
        <div className={styles.row} style={{ paddingLeft: 12 + depth * 14 }}>
          <FolderIcon size={13} className={styles.icon} />
          <span className={styles.name}>{node.name}</span>
        </div>
      )}
      {node.children.map((child) => (
        <RepoTree key={child.path || child.name} node={child} depth={depth + 1} activeFile={activeFile} />
      ))}
    </div>
  );
}
