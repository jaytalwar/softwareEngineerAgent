import { CodeLine } from "./CodeLine";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
  path: string;
  language: string;
  content: string;
}

export function CodeBlock({ path, language, content }: CodeBlockProps) {
  const lines = content.replace(/\n$/, "").split("\n");
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>{path}</div>
      <div className={styles.body}>
        {lines.map((line, i) => (
          <div key={i} className={styles.line}>
            <span className={styles.lineNo}>{i + 1}</span>
            <span className={styles.content}>
              <CodeLine content={line} language={language} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
