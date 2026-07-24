import { For } from "solid-js";
import {
  DESIGN_LAB_BASE_CSS,
  DesignLabBackLink,
  SAMPLE_RESUMES,
  useDesignLabMount,
} from "./shared";

/**
 * Proof — Typst/PDF page as full-bleed hero atmosphere.
 * Oversized galley bleeds past the viewport; brand + CTAs sit in the page margin;
 * sample CV body typesets on load.
 */
export default function HomeProof() {
  useDesignLabMount("Proof");

  return (
    <>
      <style>{DESIGN_LAB_BASE_CSS}</style>
      <style>{`
        .pf {
          --page: #fbfcfd;
          --rail: #c8d0da;
          --ink: #1c2430;
          --mute: #64748b;
          --cyan: #0e7490;
          --chrome: #334155;
          --line: #d5dde6;
          min-height: 100vh;
          background:
            radial-gradient(ellipse 80% 50% at 100% 0%, rgba(14, 116, 144, 0.07), transparent 50%),
            linear-gradient(160deg, #b7c0cb 0%, var(--rail) 45%, #aeb8c4 100%);
          color: var(--ink);
          font-family: "Space Grotesk", system-ui, sans-serif;
          position: relative;
          overflow-x: hidden;
        }
        .pf-top {
          position: relative;
          z-index: 3;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.85rem clamp(1rem, 3vw, 2rem);
        }
        .pf-local {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--chrome);
          background: rgba(251, 252, 253, 0.75);
          padding: 0.3rem 0.55rem;
          border-radius: 2px;
        }
        .pf-stage {
          position: relative;
          z-index: 2;
          min-height: calc(100vh - 3.25rem);
          padding: 0 0 2rem;
          overflow: hidden;
        }
        .pf-sheet {
          position: relative;
          width: min(110vw, 54rem);
          min-height: calc(100vh - 2rem);
          margin-left: clamp(0.75rem, 4vw, 3rem);
          background: var(--page);
          padding: clamp(2rem, 5vw, 3.25rem) clamp(1.5rem, 4vw, 3rem) 3rem;
          display: flex;
          flex-direction: column;
          box-shadow: 0 0 0 1px rgba(28, 36, 48, 0.06);
          animation: pf-settle 800ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pf-sheet::before {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: clamp(1.1rem, 3vw, 2rem);
          width: 1px;
          background: rgba(14, 116, 144, 0.28);
          pointer-events: none;
        }
        .pf-sheet::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            105deg,
            transparent 35%,
            rgba(255, 255, 255, 0.45) 48%,
            transparent 58%
          );
          background-size: 220% 100%;
          animation: pf-sheen 2.2s 0.35s ease-out both;
        }
        .pf-brand {
          font-weight: 700;
          font-size: clamp(2.25rem, 7vw, 3.5rem);
          letter-spacing: -0.045em;
          margin: 0 0 0.2rem;
          color: var(--cyan);
          animation: pf-line 500ms 120ms both;
        }
        .pf-tag {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 0.62rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--mute);
          margin: 0 0 1.5rem;
          animation: pf-line 500ms 180ms both;
        }
        .pf-headline {
          font-size: clamp(1.15rem, 2.4vw, 1.4rem);
          font-weight: 600;
          margin: 0 0 0.45rem;
          line-height: 1.3;
          max-width: 22rem;
          animation: pf-line 500ms 260ms both;
        }
        .pf-lede {
          margin: 0 0 1.5rem;
          font-size: 0.95rem;
          color: var(--mute);
          line-height: 1.5;
          max-width: 26rem;
          animation: pf-line 500ms 320ms both;
        }
        .pf-cta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.75rem;
          animation: pf-line 500ms 380ms both;
        }
        .pf-cta button {
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 0.6rem 1.05rem;
          border-radius: 3px;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 150ms ease, color 150ms ease;
        }
        .pf-cta button:focus-visible {
          outline: 2px solid var(--cyan);
          outline-offset: 2px;
        }
        .pf-cta-primary {
          background: var(--ink);
          color: var(--page);
        }
        .pf-cta-primary:hover { background: var(--cyan); }
        .pf-cta-ghost {
          background: transparent;
          color: var(--ink);
          border-color: var(--line) !important;
        }
        .pf-cta-ghost:hover { background: #f1f5f9; }
        .pf-rule {
          height: 1px;
          background: var(--line);
          margin: 0 0 1.25rem;
          transform-origin: left;
          animation: pf-rule 600ms 440ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pf-doc {
          font-family: "Source Sans 3", system-ui, sans-serif;
          flex: 1;
          min-height: 0;
        }
        .pf-doc-name {
          font-size: clamp(1.5rem, 3.5vw, 2rem);
          font-weight: 700;
          margin: 0 0 0.25rem;
          letter-spacing: -0.02em;
          animation: pf-line 450ms 500ms both;
        }
        .pf-doc-role {
          font-size: 0.92rem;
          color: var(--cyan);
          margin: 0 0 1rem;
          max-width: 28rem;
          line-height: 1.4;
          animation: pf-line 450ms 560ms both;
        }
        .pf-doc-sec {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--chrome);
          margin: 0 0 0.5rem;
          padding-bottom: 0.25rem;
          border-bottom: 1px solid var(--line);
          max-width: 32rem;
          animation: pf-line 450ms 620ms both;
        }
        .pf-doc-lines {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          max-width: 32rem;
        }
        .pf-doc-lines li {
          height: 0.6rem;
          background: #e4eaf1;
          border-radius: 1px;
          animation: pf-bar 500ms both;
        }
        .pf-doc-lines li:nth-child(1) { width: 94%; animation-delay: 680ms; }
        .pf-doc-lines li:nth-child(2) { width: 80%; animation-delay: 760ms; }
        .pf-doc-lines li:nth-child(3) { width: 88%; animation-delay: 840ms; }
        .pf-doc-lines li:nth-child(4) { width: 66%; animation-delay: 920ms; height: 0.4rem; margin-top: 0.55rem; }
        .pf-doc-lines li:nth-child(5) { width: 90%; animation-delay: 1000ms; }
        .pf-doc-lines li:nth-child(6) { width: 74%; animation-delay: 1080ms; }
        .pf-doc-lines li:nth-child(7) { width: 82%; animation-delay: 1160ms; }
        .pf-below {
          position: relative;
          z-index: 2;
          max-width: 40rem;
          margin: 0 clamp(0.75rem, 4vw, 3rem) 0;
          padding: 0 0 3rem;
        }
        .pf-below h2 {
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--chrome);
          margin: 0 0 0.85rem;
        }
        .pf-files {
          display: grid;
          gap: 0.5rem;
        }
        .pf-file {
          width: 100%;
          text-align: left;
          font: inherit;
          cursor: pointer;
          background: rgba(251, 252, 253, 0.9);
          border: 1px solid rgba(51, 65, 85, 0.12);
          padding: 0.85rem 1rem;
          border-radius: 3px;
          color: inherit;
          transition: transform 150ms ease, background 150ms ease;
        }
        .pf-file:hover,
        .pf-file:focus-visible {
          background: var(--page);
          transform: translateY(-1px);
          outline: none;
        }
        .pf-file strong {
          display: block;
          font-size: 0.95rem;
          margin-bottom: 0.15rem;
        }
        .pf-file span {
          font-size: 0.8rem;
          color: var(--mute);
        }
        @keyframes pf-settle {
          from { opacity: 0; transform: translateX(18px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes pf-sheen {
          from { background-position: 120% 0; opacity: 0.85; }
          to { background-position: -80% 0; opacity: 0; }
        }
        @keyframes pf-line {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes pf-rule {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes pf-bar {
          from { opacity: 0; transform: scaleX(0.35); transform-origin: left; }
          to { opacity: 1; transform: scaleX(1); }
        }
        @media (max-width: 640px) {
          .pf-sheet {
            width: calc(100% - 1rem);
            margin-left: 0.5rem;
            min-height: auto;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .pf-sheet, .pf-sheet::after,
          .pf-brand, .pf-tag, .pf-headline, .pf-lede, .pf-cta,
          .pf-rule, .pf-doc-name, .pf-doc-role, .pf-doc-sec,
          .pf-doc-lines li { animation: none; }
          .pf-file { transition: none; }
        }
      `}</style>
      <div class="pf">
        <div class="pf-top">
          <DesignLabBackLink />
          <span class="pf-local">Typst · local render</span>
        </div>
        <div class="pf-stage">
          <article class="pf-sheet" aria-label="Rustume home as a live proof page">
            <h1 class="pf-brand">Rustume</h1>
            <p class="pf-tag">Privacy-first · Offline-capable</p>
            <p class="pf-headline">Write once. Render precisely.</p>
            <p class="pf-lede">
              Your CV lives as structured data on this device. Export a Typst PDF when you&apos;re
              ready — no cloud required.
            </p>
            <div class="pf-cta">
              <button type="button" class="pf-cta-primary">
                New resume
              </button>
              <button type="button" class="pf-cta-ghost">
                Import
              </button>
            </div>
            <div class="pf-rule" aria-hidden="true" />
            <div class="pf-doc" aria-hidden="true">
              <p class="pf-doc-name">Eitel Dagnin</p>
              <p class="pf-doc-role">
                Automation &amp; Platform Engineer | AI-native workflows in production
              </p>
              <p class="pf-doc-sec">Experience</p>
              <ul class="pf-doc-lines">
                <li />
                <li />
                <li />
                <li />
                <li />
                <li />
                <li />
              </ul>
            </div>
          </article>
        </div>
        <section class="pf-below" aria-label="Your resumes">
          <h2>Saved proofs</h2>
          <div class="pf-files">
            <For each={SAMPLE_RESUMES}>
              {(r) => (
                <button type="button" class="pf-file">
                  <strong>{r.name}</strong>
                  <span>{r.headline}</span>
                </button>
              )}
            </For>
          </div>
        </section>
      </div>
    </>
  );
}
