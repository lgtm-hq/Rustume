import { For } from "solid-js";
import { A } from "@solidjs/router";
import { DESIGN_LAB_BASE_CSS, useDesignLabMount } from "./shared";

const DESIGNS = [
  {
    slug: "workspace",
    num: "01",
    name: "Workspace",
    thesis:
      "Document-first dock — resumes own the first viewport; brand collapses to a slim toolbar.",
  },
  {
    slug: "plate",
    num: "02",
    name: "Plate",
    thesis:
      "Metal-type stamp: condensed brand pressed into cool steel grain; verdigris ink, press proofs below.",
  },
  {
    slug: "aether",
    num: "03",
    name: "Aether",
    thesis:
      "Light air — brand as oversized weather in soft sky mist; CTAs grounded, resumes below the fold.",
  },
  {
    slug: "proof",
    num: "04",
    name: "Proof",
    thesis:
      "Typst PDF as atmosphere — oversized galley bleeds past the viewport; sample CV typesets on load.",
  },
  {
    slug: "nest",
    num: "05",
    name: "Nest",
    thesis:
      "Local-device intimacy — cool desk, soft lamp, app bezel; brand as nameplate on your machine.",
  },
] as const;

export default function DesignLabIndex() {
  useDesignLabMount("Home explorations");

  return (
    <>
      <style>{DESIGN_LAB_BASE_CSS}</style>
      <style>{`
        .dli {
          --ink: #12141a;
          --paper: #eceef2;
          --mute: #5c6470;
          --line: #c5cad3;
          --accent: #9a3b1e;
          min-height: 100vh;
          background:
            radial-gradient(ellipse 80% 50% at 10% -10%, #dfe4ec 0%, transparent 55%),
            radial-gradient(ellipse 60% 40% at 100% 0%, #e8e0d8 0%, transparent 45%),
            var(--paper);
          color: var(--ink);
          font-family: "Public Sans", system-ui, sans-serif;
          padding: clamp(1.5rem, 4vw, 3rem);
        }
        .dli-inner {
          max-width: 52rem;
          margin: 0 auto;
        }
        .dli-eyebrow {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 0.7rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--mute);
          margin-bottom: 1rem;
        }
        .dli-brand {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: clamp(3rem, 10vw, 5.5rem);
          font-weight: 400;
          line-height: 0.95;
          letter-spacing: -0.02em;
          margin: 0 0 0.75rem;
        }
        .dli-brand em {
          font-style: italic;
          color: var(--accent);
        }
        .dli-lede {
          font-size: 1.05rem;
          line-height: 1.55;
          color: var(--mute);
          max-width: 36rem;
          margin: 0 0 2.5rem;
        }
        .dli-list {
          list-style: none;
          margin: 0;
          padding: 0;
          border-top: 1px solid var(--line);
        }
        .dli-item a {
          display: grid;
          grid-template-columns: 2.5rem 1fr;
          gap: 1rem;
          padding: 1.25rem 0;
          border-bottom: 1px solid var(--line);
          text-decoration: none;
          color: inherit;
          transition: background 180ms ease, padding-left 180ms ease;
        }
        .dli-item a:hover,
        .dli-item a:focus-visible {
          padding-left: 0.5rem;
          background: rgba(255, 255, 255, 0.35);
          outline: none;
        }
        .dli-num {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 0.75rem;
          color: var(--mute);
          padding-top: 0.35rem;
        }
        .dli-name {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 1.5rem;
          margin: 0 0 0.35rem;
        }
        .dli-thesis {
          margin: 0;
          font-size: 0.92rem;
          line-height: 1.5;
          color: var(--mute);
        }
        .dli-foot {
          margin-top: 2.5rem;
          font-size: 0.8rem;
          color: var(--mute);
        }
        .dli-foot a {
          color: var(--ink);
        }
        @media (prefers-reduced-motion: reduce) {
          .dli-item a { transition: none; }
        }
      `}</style>
      <div class="dli">
        <div class="dli-inner">
          <p class="dli-eyebrow">Design lab · Home explorations</p>
          <h1 class="dli-brand">
            Five ways home
            <br />
            <em>might feel</em>
          </h1>
          <p class="dli-lede">
            Standalone prototypes for Rustume’s privacy-first resume home. Live production Home is
            untouched — open each direction, compare structure and tone.
          </p>
          <ol class="dli-list">
            <For each={DESIGNS}>
              {(d) => (
                <li class="dli-item">
                  <A href={`/design-lab/home/${d.slug}`}>
                    <span class="dli-num">{d.num}</span>
                    <span>
                      <h2 class="dli-name">{d.name}</h2>
                      <p class="dli-thesis">{d.thesis}</p>
                    </span>
                  </A>
                </li>
              )}
            </For>
          </ol>
          <p class="dli-foot">
            Production app stays at <A href="/">/</A>. These routes skip AppShell chrome.
          </p>
        </div>
      </div>
    </>
  );
}
