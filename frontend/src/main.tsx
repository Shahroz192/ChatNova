import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./contexts/ThemeContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/variables.css";
import "./index.css";
import "./styles/global.css";
import "./styles/Utilities.css";
import "./styles/DarkOverrides.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider defaultTheme="system">
            <App />
        </ThemeProvider>
    </React.StrictMode>,
);
