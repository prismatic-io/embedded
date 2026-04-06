import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as prismatic from "@prismatic-io/embedded";
import "./index.css";
import App from "./App.tsx";

prismatic.init({
  prismaticUrl: "https://bk-test-context-config.local.prismatic-dev.io:3000",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
