import { useEffect, useState } from "react";

function readHash(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}

export function useHashRoute(): [string, (path: string) => void] {
  const [hash, setHash] = useState(readHash);

  useEffect(() => {
    const onChange = () => setHash(readHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  return [hash, navigate];
}
