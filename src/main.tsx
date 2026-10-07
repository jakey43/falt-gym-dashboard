import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/dm-sans";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./styles.css";
import App from "./App.tsx";

// Fel som inträffar utanför React (t.ex. i en händelse) visas också i stället för en tom sida.
function showFatal(message: string) {
  const root = document.getElementById("root");
  if (!root || root.childElementCount > 0) return;
  root.innerHTML = `<div style="padding:24px;font-family:system-ui;max-width:640px;margin:40px auto;background:#fffcf5;border-radius:20px">
    <strong>Fält kunde inte starta</strong><pre style="white-space:pre-wrap;font-size:12px"></pre></div>`;
  root.querySelector("pre")!.textContent = `${message}\n\n${navigator.userAgent}`;
}
window.addEventListener("error", (e) => showFatal(String(e.error?.stack ?? e.message)));
window.addEventListener("unhandledrejection", (e) => showFatal(String(e.reason?.stack ?? e.reason)));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
