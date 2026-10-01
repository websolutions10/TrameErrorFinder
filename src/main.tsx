import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

function mount() {
  const el = document.getElementById("root");
  if (el) {
    createRoot(el).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
