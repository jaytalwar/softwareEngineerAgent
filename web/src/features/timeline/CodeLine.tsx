import { Fragment } from "react";
import { tokenizePython } from "../../lib/highlight";
import styles from "./CodeLine.module.css";

interface CodeLineProps {
  content: string;
  language?: string;
}

export function CodeLine({ content, language = "python" }: CodeLineProps) {
  if (content === "") return <>{" "}</>;
  if (language !== "python") return <>{content}</>;

  return (
    <>
      {tokenizePython(content).map((token, i) => (
        <Fragment key={i}>
          {token.type === "plain" ? token.text : <span className={styles[token.type]}>{token.text}</span>}
        </Fragment>
      ))}
    </>
  );
}
