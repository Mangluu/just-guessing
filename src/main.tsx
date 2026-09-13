import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Shell from "./ui/Shell.tsx";
import "./ui/app.css";

createRoot(document.getElementById("root")!).render(<StrictMode><Shell /></StrictMode>);
