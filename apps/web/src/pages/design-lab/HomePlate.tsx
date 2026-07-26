import { For } from "solid-js";
import {
  DESIGN_LAB_BASE_CSS,
  DesignLabBackLink,
  SAMPLE_RESUMES,
  useDesignLabMount,
} from "./shared";

/**
 * Plate — industrial metal type / letterpress craft.
 * Cool steel paper + verdigris ink; brand as stamped condensed wordmark.
 * Not cream/terracotta, not broadsheet, not Atelier’s serif tray.
 */
export default function HomePlate() {
  useDesignLabMount("Plate");

  return (
    <>
      <style>{DESIGN_LAB_BASE_CSS}</style>
      <style>{`
        .pl {
          --ink: #16191f;
          --steel: #d8dde3;
          --plate: #eef0f3;
          --mute: #5c6570;
          --verdigris: #2f6f68;
          --verdigris-deep: #1a3d3a;
          --rule: #a8b0ba;
          min-height: 100vh;
          background:
            radial-gradient(ellipse 70% 45% at 80% 0%, rgba(47, 111, 104, 0.08), transparent 55%),
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(22, 25, 31, 0.015) 2px,
              rgba(22, 25, 31, 0.015) 3px
            ),
            var(--steel);
          color: var(--ink);
          font-family: "IBM Plex Sans", system-ui, sans-serif;
          position: relative;
          overflow-x: hidden;
        }
        .pl::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='0.45'/%3E%3C/svg%3E");
          opacity: 0.07;
          pointer-events: none;
          mix-blend-mode: multiply;
        }
        .pl > * { position: relative; z-index: 1; }
        .pl-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem clamp(1rem, 3vw, 2.5rem);
        }
        .pl-local {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 0.65rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--verdigris-deep);
          border: 1px solid var(--verdigris);
          padding: 0.3rem 0.55rem;
          background: rgba(238, 240, 243, 0.65);
        }
        .pl-hero {
          min-height: calc(100vh - 3.5rem);
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 2rem clamp(1rem, 4vw, 3rem) 3rem;
          max-width: 72rem;
          margin: 0 auto;
        }
        .pl-brand {
          font-family: "Big Shoulders Display", system-ui, sans-serif;
          font-weight: 800;
          font-size: clamp(4.5rem, 18vw, 11rem);
          line-height: 0.82;
          letter-spacing: -0.02em;
          text-transform: uppercase;
          margin: 0 0 1.25rem;
          color: var(--ink);
          text-shadow:
            0 1px 0 rgba(255, 255, 255, 0.55),
            0 -1px 0 rgba(22, 25, 31, 0.18),
            2px 3px 0 rgba(47, 111, 104, 0.12);
          animation: pl-stamp 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pl-brand span {
          display: inline-block;
          border-bottom: 6px solid var(--verdigris);
          padding-bottom: 0.05em;
        }
        .pl-headline {
          font-size: clamp(1.15rem, 2.4vw, 1.45rem);
          font-weight: 500;
          max-width: 28rem;
          margin: 0 0 0.5rem;
          line-height: 1.35;
          animation: pl-rise 600ms 120ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pl-lede {
          margin: 0 0 1.75rem;
          color: var(--mute);
          font-size: 1rem;
          max-width: 26rem;
          line-height: 1.5;
          animation: pl-rise 600ms 200ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pl-cta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          animation: pl-rise 600ms 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pl-cta button {
          font-family: inherit;
          font-size: 0.9rem;
          font-weight: 600;
          padding: 0.7rem 1.15rem;
          border-radius: 2px;
          cursor: pointer;
          border: 1.5px solid var(--ink);
          transition: background 160ms ease, color 160ms ease, transform 160ms ease;
        }
        .pl-cta button:focus-visible {
          outline: 2px solid var(--verdigris);
          outline-offset: 3px;
        }
        .pl-cta-primary {
          background: var(--ink);
          color: var(--plate);
        }
        .pl-cta-primary:hover {
          background: var(--verdigris-deep);
          border-color: var(--verdigris-deep);
          transform: translateY(-1px);
        }
        .pl-cta-ghost {
          background: transparent;
          color: var(--ink);
        }
        .pl-cta-ghost:hover {
          background: rgba(255, 255, 255, 0.45);
        }
        .pl-proofs {
          border-top: 1px solid var(--rule);
          background: var(--plate);
          padding: clamp(2rem, 5vw, 3.5rem) clamp(1rem, 4vw, 3rem);
        }
        .pl-proofs-inner {
          max-width: 72rem;
          margin: 0 auto;
        }
        .pl-proofs h2 {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 0.7rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 500;
          color: var(--mute);
          margin: 0 0 1.25rem;
        }
        .pl-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
          gap: 1rem;
        }
        .pl-card {
          background: #fff;
          border: 1px solid var(--rule);
          padding: 1.15rem 1.2rem;
          text-align: left;
          cursor: pointer;
          font: inherit;
          color: inherit;
          box-shadow: 3px 3px 0 rgba(22, 25, 31, 0.06);
          transition: transform 160ms ease, box-shadow 160ms ease;
        }
        .pl-card:hover,
        .pl-card:focus-visible {
          transform: translate(-2px, -2px);
          box-shadow: 5px 5px 0 rgba(47, 111, 104, 0.2);
          outline: none;
        }
        .pl-card h3 {
          font-family: "Big Shoulders Display", system-ui, sans-serif;
          font-size: 1.45rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          margin: 0 0 0.35rem;
        }
        .pl-card p {
          margin: 0 0 0.75rem;
          font-size: 0.88rem;
          color: var(--mute);
          line-height: 1.45;
        }
        .pl-meta {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 0.65rem;
          color: var(--verdigris);
          letter-spacing: 0.06em;
        }
        @keyframes pl-stamp {
          from { opacity: 0; transform: translateY(12px) scale(1.02); filter: blur(2px); }
          to { opacity: 1; transform: none; filter: none; }
        }
        @keyframes pl-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: none; }
        }
        @media (max-width: 640px) {
          .pl-brand { font-size: clamp(3.5rem, 22vw, 5rem); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pl-brand, .pl-headline, .pl-lede, .pl-cta { animation: none; }
          .pl-card, .pl-cta button { transition: none; }
        }
      `}</style>
      <div class="pl">
        <div class="pl-top">
          <DesignLabBackLink />
          <span class="pl-local">On this device</span>
        </div>
        <header class="pl-hero">
          <h1 class="pl-brand">
            <span>Rustume</span>
          </h1>
          <p class="pl-headline">Cast your CV in metal-sharp type — offline, yours.</p>
          <p class="pl-lede">
            Privacy-first resume builder. Edit locally, export precise Typst PDFs. Nothing leaves
            this machine unless you say so.
          </p>
          <div class="pl-cta">
            <button type="button" class="pl-cta-primary">
              New resume
            </button>
            <button type="button" class="pl-cta-ghost">
              Import file
            </button>
          </div>
        </header>
        <section class="pl-proofs" aria-label="Your resumes">
          <div class="pl-proofs-inner">
            <h2>Press proofs</h2>
            <div class="pl-grid">
              <For each={SAMPLE_RESUMES}>
                {(r) => (
                  <button type="button" class="pl-card">
                    <h3>{r.name}</h3>
                    <p>{r.headline}</p>
                    <span class="pl-meta">
                      {r.updated}
                      {r.locked ? " · locked" : ""}
                    </span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
