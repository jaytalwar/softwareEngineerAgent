import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Button } from "../../components/Button";
import { TextArea } from "../../components/TextArea";
import styles from "./NewTaskPanel.module.css";

interface NewTaskPanelProps {
  onCreate: (title: string) => void;
  isOffline: boolean;
  hasTasks: boolean;
}

export function NewTaskPanel({ onCreate, isOffline, hasTasks }: NewTaskPanelProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Describe what you want built or fixed.");
      return;
    }
    if (trimmed.length < 8) {
      setError("A bit more detail will help the Planner.");
      return;
    }
    setError(undefined);
    onCreate(trimmed);
    setValue("");
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
    <div className={styles.wrap}>
      {!hasTasks && (
        <div className={styles.hero}>
          <p className={styles.eyebrow}>Planner · Coder · Reviewer</p>
          <h1 className={styles.title}>
            Describe the task.
            <br />
            Orbit runs it to completion.
          </h1>
          <p className={styles.subtitle}>
            A Planner breaks it down, a Coder implements it with real file, shell, git, and test
            tools, and a Reviewer checks the work — looping until it passes or the budget runs
            out.
          </p>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <TextArea
          label="Task"
          placeholder="e.g. Add a /health endpoint that returns { status: 'ok' } and a passing test."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          error={error}
          disabled={isOffline}
          rows={4}
        />
        <div className={styles.formFooter}>
          <p className={styles.hint}>
            {isOffline ? "Reconnect to start a new task." : "⌘/Ctrl + Enter to submit"}
          </p>
          <Button type="submit" variant="primary" disabled={isOffline}>
            Run Task
          </Button>
        </div>
      </form>
    </div>
  );
}
