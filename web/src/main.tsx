import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline caching is a progressive enhancement — a failed registration
        // (unsupported browser, blocked by privacy settings) shouldn't break the app.
      });
    });
  } else {
    // A service worker has no business running against the Vite dev server:
    // it broke local dev once already here — a worker registered under an
    // earlier version of this UI kept cache-first-serving old module files
    // after a rewrite, with no way to notice, since dev mode serves stable
    // unhashed paths (a production build's content-hashed filenames don't
    // have this problem). Actively clean up anything left over from before
    // this fix, on every dev-mode load.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
  }
}
