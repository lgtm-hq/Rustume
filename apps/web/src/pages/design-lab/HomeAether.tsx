import { For } from "solid-js";
import {
  DESIGN_LAB_BASE_CSS,
  DesignLabBackLink,
  SAMPLE_RESUMES,
  useDesignLabMount,
} from "./shared";

/**
 * Aether — light air, brand as weather.
 * Soft sky atmosphere; oversized geometric wordmark; grounded CTAs.
 */
export default function HomeAether() {
  useDesignLabMount("Aether");

  return (
    <>
      <style>{DESIGN_LAB_BASE_CSS}</style>
      <style>{`
        .ae {
          --sky: #f4f8fb;
          --mist: #c5d9e8;
          --deep: #1b2a41;
          --clear: #3a7ca5;
          --foam: #ffffff;
          --local: #2a9d8f;
          --mute: #5a6b7d;
          min-height: 100vh;
          background:
            radial-gradient(ellipse 90% 60% at 15% 10%, rgba(197, 217, 232, 0.85), transparent 50%),
            radial-gradient(ellipse 70% 50% at 90% 30%, rgba(42, 157, 143, 0.12), transparent 45%),
            radial-gradient(ellipse 50% 40% at 50% 100%, rgba(58, 124, 165, 0.1), transparent 50%),
            linear-gradient(180deg, #e8f1f7 0%, var(--sky) 40%, #eef4f8 100%);
          color: var(--deep);
          font-family: "Manrope", system-ui, sans-serif;
          position: relative;
          overflow-x: hidden;
        }
        .ae-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(48px);
          pointer-events: none;
          animation: ae-drift 18s ease-in-out infinite alternate;
        }
        .ae-orb-a {
          width: min(48vw, 28rem);
          height: min(48vw, 28rem);
          background: rgba(197, 217, 232, 0.55);
          top: -8%;
          right: -5%;
        }
        .ae-orb-b {
          width: min(36vw, 20rem);
          height: min(36vw, 20rem);
          background: rgba(42, 157, 143, 0.18);
          bottom: 20%;
          left: -8%;
          animation-delay: -6s;
          animation-duration: 22s;
        }
        .ae-top {
          position: relative;
          z-index: 2;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem clamp(1rem, 3vw, 2.5rem);
        }
        .ae-local {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--local);
        }
        .ae-hero {
          position: relative;
          z-index: 2;
          min-height: calc(100vh - 3.5rem);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 2rem clamp(1rem, 4vw, 3rem) 3.5rem;
        }
        .ae-brand {
          font-family: "Syne", system-ui, sans-serif;
          font-weight: 800;
          font-size: clamp(3.75rem, 16vw, 9.5rem);
          line-height: 0.9;
          letter-spacing: -0.045em;
          margin: 0 0 1.5rem;
          color: var(--deep);
          background: linear-gradient(135deg, var(--deep) 20%, var(--clear) 55%, var(--local) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: ae-breathe 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .ae-headline {
          font-size: clamp(1.2rem, 2.5vw, 1.55rem);
          font-weight: 600;
          margin: 0 0 0.5rem;
          max-width: 28rem;
          line-height: 1.35;
          animation: ae-rise 700ms 100ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .ae-lede {
          margin: 0 0 1.75rem;
          color: var(--mute);
          font-size: 1rem;
          max-width: 26rem;
          line-height: 1.55;
          animation: ae-rise 700ms 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .ae-cta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          justify-content: center;
          animation: ae-rise 700ms 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .ae-cta button {
          font-family: inherit;
          font-size: 0.92rem;
          font-weight: 600;
          padding: 0.75rem 1.35rem;
          border-radius: 6px;
          cursor: pointer;
          border: none;
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }
        .ae-cta button:focus-visible {
          outline: 2px solid var(--clear);
          outline-offset: 3px;
        }
        .ae-cta-primary {
          background: var(--deep);
          color: var(--foam);
        }
        .ae-cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(27, 42, 65, 0.18);
        }
        .ae-cta-ghost {
          background: rgba(255, 255, 255, 0.65);
          color: var(--deep);
          border: 1px solid rgba(27, 42, 65, 0.12) !important;
          backdrop-filter: blur(8px);
        }
        .ae-cta-ghost:hover {
          background: var(--foam);
        }
        .ae-library {
          position: relative;
          z-index: 2;
          padding: 0 clamp(1rem, 4vw, 3rem) clamp(2.5rem, 6vw, 4rem);
          max-width: 48rem;
          margin: 0 auto;
        }
        .ae-library h2 {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--mute);
          margin: 0 0 1rem;
          text-align: center;
        }
        .ae-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }
        .ae-item {
          width: 100%;
          text-align: left;
          font: inherit;
          color: inherit;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.55);
          border: 1px solid rgba(27, 42, 65, 0.08);
          backdrop-filter: blur(10px);
          border-radius: 8px;
          padding: 1rem 1.15rem;
          transition: background 160ms ease, transform 160ms ease;
        }
        .ae-item:hover,
        .ae-item:focus-visible {
          background: rgba(255, 255, 255, 0.9);
          transform: translateY(-2px);
          outline: none;
        }
        .ae-item h3 {
          font-family: "Syne", system-ui, sans-serif;
          font-size: 1.1rem;
          font-weight: 700;
          margin: 0 0 0.25rem;
        }
        .ae-item p {
          margin: 0;
          font-size: 0.88rem;
          color: var(--mute);
          line-height: 1.4;
        }
        @keyframes ae-drift {
          from { transform: translate(0, 0); }
          to { transform: translate(-3%, 4%); }
        }
        @keyframes ae-breathe {
          from { opacity: 0; transform: scale(0.96); letter-spacing: -0.02em; }
          to { opacity: 1; transform: none; letter-spacing: -0.045em; }
        }
        @keyframes ae-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ae-orb { animation: none; }
          .ae-brand, .ae-headline, .ae-lede, .ae-cta { animation: none; }
          .ae-item, .ae-cta button { transition: none; }
        }
      `}</style>
      <div class="ae">
        <div class="ae-orb ae-orb-a" aria-hidden="true" />
        <div class="ae-orb ae-orb-b" aria-hidden="true" />
        <div class="ae-top">
          <DesignLabBackLink />
          <span class="ae-local">Local · offline ready</span>
        </div>
        <header class="ae-hero">
          <h1 class="ae-brand">Rustume</h1>
          <p class="ae-headline">Your resume, light on the machine.</p>
          <p class="ae-lede">
            Build and export PDFs without an account. Rustume stays on your device — open air,
            closed data.
          </p>
          <div class="ae-cta">
            <button type="button" class="ae-cta-primary">
              Start a resume
            </button>
            <button type="button" class="ae-cta-ghost">
              Import JSON
            </button>
          </div>
        </header>
        <section class="ae-library" aria-label="Your resumes">
          <h2>On this device</h2>
          <ul class="ae-list">
            <For each={SAMPLE_RESUMES}>
              {(r) => (
                <li>
                  <button type="button" class="ae-item">
                    <h3>{r.name}</h3>
                    <p>{r.headline}</p>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </section>
      </div>
    </>
  );
}
