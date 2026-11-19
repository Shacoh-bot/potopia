import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BRAND } from "@app/config/brand";
import { SurvivorsGame } from "../ui/Game";
import "../ui/survivors.css";
import "./preview.css";

const element = document.getElementById("root");
if (element)
  createRoot(element).render(
    <StrictMode>
      <main className="sv-preview">
        <nav aria-label="Contexte de l’aperçu">
          <strong>{BRAND.name}</strong>
          <span>Atelier des jeux / Aperçu local</span>
        </nav>
        <SurvivorsGame />
        <p className="sv-preview-note">Prototype local · Les parties ne sont pas sauvegardées.</p>
      </main>
    </StrictMode>,
  );
