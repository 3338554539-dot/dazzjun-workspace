import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./auth";
import { PlatformGate } from "./components/PlatformGate";
import { setupPWAUpdate } from "./pwa/update";
import { ThemeProvider } from "./theme";
import "./styles.css";

console.info(`[BOOT]\npathname: ${window.location.pathname}\ntime: ${new Date().toISOString()}`);
setupPWAUpdate();
createRoot(document.getElementById("root")!).render(<StrictMode><ThemeProvider><AuthProvider><PlatformGate/></AuthProvider></ThemeProvider></StrictMode>);
