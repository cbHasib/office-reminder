import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Block right-click context menu globally for a native-app experience
window.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
