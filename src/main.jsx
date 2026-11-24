
import React from "react";
import ReactDOM from "react-dom/client";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import "./index.css";

// Tell Capgo that the app has started successfully.
CapacitorUpdater.notifyAppReady();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </React.StrictMode>
);
