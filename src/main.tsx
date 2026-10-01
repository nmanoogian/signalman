import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { VoiceCheck } from "./components/VoiceCheck";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");

// A diagnostic route for trying the speech recognizer on a real device. Netlify rewrites every
// path to this bundle, so matching on the pathname is all the routing the app needs.
const isVoiceCheck = window.location.pathname.replace(/\/+$/, "") === "/voice-check";

createRoot(container).render(<StrictMode>{isVoiceCheck ? <VoiceCheck /> : <App />}</StrictMode>);
