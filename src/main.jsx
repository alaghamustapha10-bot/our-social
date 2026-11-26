import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import "./index.css";

// Acknowledge a successful native app start so Capgo can keep a downloaded
// update instead of rolling it back. The updater is native-only.
if (Capacitor.isNativePlatform()) {
  void CapacitorUpdater.notifyAppReady().catch((error) => {
    console.error("[Capgo] Could not confirm app readiness:", error);
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </React.StrictMode>
);
