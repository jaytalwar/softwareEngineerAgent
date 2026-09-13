import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Button } from "../components/Button";
import { ArrowUpIcon, AttachIcon } from "../components/icons";
import styles from "./CommandBar.module.css";

interface CommandBarProps {
  onSubmit: (title: string) => void;
  disabled: boolean;
  disabledReason?: string;
  placeholder?: string;
}

const MAX_HEIGHT = 200;

export function CommandBar({ onSubmit, disabled, disabledReason, placeholder }: CommandBarProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(MAX_HEIGHT, el.scrollHeight)}px`;
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
    requestAnimationFrame(resize);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form className={styles.bar} onSubmit={handleSubmit}>
      {disabled && disabledReason && <p className={styles.disabledHint}>{disabledReason}</p>}
      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          rows={1}
          placeholder={
            placeholder ?? "Describe what you want the agent to build, fix, test, or investigate..."
          }
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            resize();
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <div className={styles.actions}>
          <button type="button" className={styles.attachButton} disabled={disabled} title="Attach repository">
            <AttachIcon size={14} /> Attach repository
          </button>
          <Button type="submit" variant="primary" size="md" disabled={disabled || !value.trim()}>
            Run Agent <ArrowUpIcon size={13} />
          </Button>
        </div>
      </div>
      <p className={styles.shortcutHint}>⌘/Ctrl + Enter to run</p>
    </form>
  );
}
