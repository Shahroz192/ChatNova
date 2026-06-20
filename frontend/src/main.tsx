import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./contexts/ThemeContext";

/* Tailwind v4 entry — also includes CSS variables for legacy compatibility */
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider defaultTheme="system">
            <App />
        </ThemeProvider>
    </React.StrictMode>,
);
