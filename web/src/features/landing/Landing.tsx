import { useRef } from "react";
import { Button } from "../../components/Button";
import { CommandBar } from "../../app/CommandBar";
import type { ConnectedRepo } from "../../lib/types";
import { RepoConnect } from "./RepoConnect";
import styles from "./Landing.module.css";

interface LandingProps {
  onSubmit: (title: string) => void;
  onRunDemo: () => void;
  disabled: boolean;
  disabledReason?: string;
  backendAvailable: boolean;
  connectedRepo: ConnectedRepo | null;
  onConnectRepo: (repo: ConnectedRepo) => void;
  onDisconnectRepo: () => void;
}

const STEPS = ["Understand", "Plan", "Code", "Test", "Verify"];

export function Landing({
  onSubmit,
  onRunDemo,
  disabled,
  disabledReason,
  backendAvailable,
  connectedRepo,
  onConnectRepo,
  onDisconnectRepo,
}: LandingProps) {
  const commandBarRef = useRef<HTMLDivElement>(null);

  function focusCommandBar() {
    const textarea = commandBarRef.current?.querySelector("textarea");
    textarea?.focus();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Your AI Software Engineer.</h1>
        <p className={styles.subtitle}>Understand. Modify. Test. Ship.</p>
        <p className={styles.supporting}>
          An autonomous software engineering agent that can inspect repositories, modify code,
          run tests, and validate its own work.
        </p>
        <div className={styles.ctaRow}>
          <Button variant="primary" size="lg" onClick={focusCommandBar} disabled={disabled}>
            Start a task
          </Button>
          <Button variant="secondary" size="lg" onClick={onRunDemo} disabled={disabled}>
            Run interactive demo
          </Button>
        </div>

        <div className={styles.workflow} aria-hidden="true">
          {STEPS.map((step, i) => (
            <div key={step} className={styles.workflowStep}>
              <span className={styles.workflowLabel}>{step}</span>
              {i < STEPS.length - 1 && <span className={styles.workflowArrow}>→</span>}
            </div>
          ))}
        </div>
      </div>

      <div ref={commandBarRef} className={styles.commandBarWrap}>
        <p className={styles.backendStatus}>
          <span
            className={[styles.backendDot, backendAvailable ? styles.backendUp : styles.backendDown].join(
              " ",
            )}
            aria-hidden="true"
          />
          {backendAvailable
            ? "Backend connected — a typed task runs the real agent."
            : "Backend not detected — tasks run in simulation. Run Demo always works."}
        </p>
        <RepoConnect
          connectedRepo={connectedRepo}
          onConnect={onConnectRepo}
          onDisconnect={onDisconnectRepo}
          disabled={!backendAvailable}
        />
        <CommandBar onSubmit={onSubmit} disabled={disabled} disabledReason={disabledReason} />
      </div>
    </div>
  );
}
