import React from "react";
import ReactDOM from "react-dom/client";
import OverlayWindow from "./screens/OverlayWindow";
import "./styles.css";

// Block right-click context menu globally for a native-app experience
window.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OverlayWindow />
  </React.StrictMode>
);
