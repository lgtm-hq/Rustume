import { For } from "solid-js";
import {
  DESIGN_LAB_BASE_CSS,
  DesignLabBackLink,
  SAMPLE_RESUMES,
  useDesignLabMount,
} from "./shared";

/**
 * Nest — warm local-device intimacy.
 * Cool aluminum desk + soft lamp light on a device bezel; brand as nameplate.
 * Avoids cream+terracotta: slate desk, jade trust, amber lamp only as rim light.
 */
export default function HomeNest() {
  useDesignLabMount("Nest");

  return (
    <>
      <style>{DESIGN_LAB_BASE_CSS}</style>
      <style>{`
        .ne {
          --desk: #dce2e9;
          --desk-deep: #c5ced8;
          --bezel: #2a313c;
          --bezel-edge: #1c222b;
          --screen: #f7f9fb;
          --ink: #1a1f26;
          --mute: #5c6673;
          --jade: #2d6a5a;
          --jade-soft: #d8ebe4;
          --lamp: #e8c48a;
          min-height: 100vh;
          background:
            radial-gradient(ellipse 55% 45% at 70% 15%, rgba(232, 196, 138, 0.28), transparent 55%),
            radial-gradient(ellipse 40% 35% at 10% 80%, rgba(45, 106, 90, 0.08), transparent 50%),
            linear-gradient(165deg, var(--desk) 0%, var(--desk-deep) 100%);
          color: var(--ink);
          font-family: "Public Sans", system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .ne-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem clamp(1rem, 3vw, 2rem);
          position: relative;
          z-index: 2;
        }
        .ne-stage {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0.5rem clamp(1rem, 4vw, 2.5rem) 2.5rem;
          position: relative;
          z-index: 2;
        }
        .ne-device {
          width: min(100%, 34rem);
          background: var(--bezel);
          border-radius: 14px;
          padding: 0.65rem 0.65rem 1rem;
          box-shadow:
            0 0 0 1px var(--bezel-edge),
            0 28px 56px rgba(28, 34, 43, 0.28),
            0 0 80px rgba(232, 196, 138, 0.12);
          animation: ne-lift 750ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .ne-chin {
          display: flex;
          justify-content: center;
          padding: 0.35rem 0 0.55rem;
        }
        .ne-dot {
          width: 0.45rem;
          height: 0.45rem;
          border-radius: 50%;
          background: #3d4654;
          box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.35);
        }
        .ne-screen {
          background: var(--screen);
          border-radius: 8px;
          padding: clamp(1.35rem, 4vw, 2rem);
          min-height: 22rem;
          display: flex;
          flex-direction: column;
        }
        .ne-brand {
          font-family: "Sora", system-ui, sans-serif;
          font-weight: 700;
          font-size: clamp(1.85rem, 5vw, 2.4rem);
          letter-spacing: -0.035em;
          margin: 0 0 0.35rem;
          animation: ne-in 500ms 120ms both;
        }
        .ne-brand em {
          font-style: normal;
          color: var(--jade);
        }
        .ne-where {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--jade);
          background: var(--jade-soft);
          padding: 0.25rem 0.55rem;
          border-radius: 4px;
          margin-bottom: 1.25rem;
          width: fit-content;
          animation: ne-in 500ms 180ms both;
        }
        .ne-where::before {
          content: "";
          width: 0.4rem;
          height: 0.4rem;
          border-radius: 50%;
          background: var(--jade);
          animation: ne-pulse 2.4s ease-in-out infinite;
        }
        .ne-headline {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 0.4rem;
          line-height: 1.35;
          animation: ne-in 500ms 240ms both;
        }
        .ne-lede {
          margin: 0 0 1.35rem;
          font-size: 0.92rem;
          color: var(--mute);
          line-height: 1.5;
          animation: ne-in 500ms 300ms both;
        }
        .ne-cta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          animation: ne-in 500ms 360ms both;
        }
        .ne-cta button {
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 0.6rem 1rem;
          border-radius: 5px;
          cursor: pointer;
          border: none;
          transition: background 150ms ease, transform 150ms ease;
        }
        .ne-cta button:focus-visible {
          outline: 2px solid var(--jade);
          outline-offset: 2px;
        }
        .ne-cta-primary {
          background: var(--bezel);
          color: var(--screen);
        }
        .ne-cta-primary:hover {
          background: var(--jade);
          transform: translateY(-1px);
        }
        .ne-cta-ghost {
          background: #e8ecf1;
          color: var(--ink);
        }
        .ne-cta-ghost:hover { background: #dde3ea; }
        .ne-files-label {
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--mute);
          margin: 0 0 0.65rem;
          animation: ne-in 500ms 420ms both;
        }
        .ne-files {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          animation: ne-in 500ms 480ms both;
        }
        .ne-file {
          width: 100%;
          text-align: left;
          font: inherit;
          cursor: pointer;
          background: #fff;
          border: 1px solid #e2e7ee;
          border-radius: 6px;
          padding: 0.75rem 0.85rem;
          color: inherit;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .ne-file:hover,
        .ne-file:focus-visible {
          border-color: var(--jade);
          box-shadow: 0 0 0 3px rgba(45, 106, 90, 0.12);
          outline: none;
        }
        .ne-file strong {
          display: block;
          font-family: "Sora", system-ui, sans-serif;
          font-size: 0.92rem;
          font-weight: 600;
          margin-bottom: 0.15rem;
        }
        .ne-file span {
          font-size: 0.78rem;
          color: var(--mute);
          line-height: 1.35;
          display: block;
        }
        .ne-foot {
          margin-top: 1.25rem;
          text-align: center;
          font-size: 0.75rem;
          color: var(--mute);
          max-width: 22rem;
        }
        @keyframes ne-lift {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: none; }
        }
        @keyframes ne-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes ne-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ne-device, .ne-brand, .ne-where, .ne-headline, .ne-lede,
          .ne-cta, .ne-files-label, .ne-files { animation: none; }
          .ne-where::before { animation: none; }
          .ne-file, .ne-cta button { transition: none; }
        }
      `}</style>
      <div class="ne">
        <div class="ne-top">
          <DesignLabBackLink />
        </div>
        <div class="ne-stage">
          <div class="ne-device">
            <div class="ne-chin" aria-hidden="true">
              <span class="ne-dot" />
            </div>
            <div class="ne-screen">
              <h1 class="ne-brand">
                Rust<em>ume</em>
              </h1>
              <p class="ne-where">On this device · not in the cloud</p>
              <p class="ne-headline">A quiet place for the CV you actually own.</p>
              <p class="ne-lede">
                Open the editor, tweak a line, export a PDF. Rustume keeps your resumes on this
                device — intimate, local, unhurried.
              </p>
              <div class="ne-cta">
                <button type="button" class="ne-cta-primary">
                  Open editor
                </button>
                <button type="button" class="ne-cta-ghost">
                  Import resume
                </button>
              </div>
              <p class="ne-files-label">Files here</p>
              <ul class="ne-files">
                <For each={SAMPLE_RESUMES}>
                  {(r) => (
                    <li>
                      <button type="button" class="ne-file">
                        <strong>{r.name}</strong>
                        <span>{r.headline}</span>
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </div>
          <p class="ne-foot">No account wall. Your machine is the product surface.</p>
        </div>
      </div>
    </>
  );
}
