import { For } from "solid-js";
import {
  DESIGN_LAB_BASE_CSS,
  DesignLabBackLink,
  SAMPLE_RESUMES,
  useDesignLabMount,
} from "./shared";

/**
 * Workspace — document-first dock.
 * Slim toolbar; resume grid owns the first viewport.
 */
export default function HomeWorkspace() {
  useDesignLabMount("Workspace");

  return (
    <>
      <style>{DESIGN_LAB_BASE_CSS}</style>
      <style>{`
        .ws {
          --bg: #e9ecef;
          --surface: #f7f8fa;
          --ink: #1a2330;
          --mute: #667085;
          --line: #d0d5dd;
          --teal: #0f766e;
          --teal-soft: #ccfbf1;
          min-height: 100vh;
          background: var(--bg);
          color: var(--ink);
          font-family: "IBM Plex Sans", system-ui, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .ws-dock {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          padding: 0.65rem 1rem;
          background: rgba(247, 248, 250, 0.92);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--line);
        }
        .ws-brand {
          font-family: "Sora", system-ui, sans-serif;
          font-weight: 700;
          font-size: 0.95rem;
          letter-spacing: -0.03em;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .ws-brand-mark {
          width: 1.35rem;
          height: 1.35rem;
          background: var(--ink);
          color: var(--surface);
          display: grid;
          place-items: center;
          font-size: 0.7rem;
          font-weight: 700;
          border-radius: 3px;
        }
        .ws-local {
          font-size: 0.7rem;
          font-weight: 500;
          color: var(--teal);
          background: var(--teal-soft);
          padding: 0.2rem 0.5rem;
          border-radius: 3px;
        }
        .ws-spacer { flex: 1; min-width: 0.5rem; }
        .ws-search {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: var(--bg);
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 0.35rem 0.65rem;
          min-width: min(100%, 14rem);
        }
        .ws-search input {
          border: none;
          background: transparent;
          font: inherit;
          font-size: 0.8rem;
          width: 100%;
          outline: none;
          color: var(--ink);
        }
        .ws-search input::placeholder { color: var(--mute); }
        .ws-dock button {
          font-family: inherit;
          font-size: 0.78rem;
          font-weight: 600;
          border-radius: 6px;
          border: 1px solid transparent;
          padding: 0.4rem 0.75rem;
          cursor: pointer;
          transition: background 140ms ease, border-color 140ms ease;
        }
        .ws-dock button.is-primary {
          background: var(--teal);
          color: #fff;
        }
        .ws-dock button.is-primary:hover,
        .ws-dock button.is-primary:focus-visible {
          background: #0d5f59;
          outline: none;
        }
        .ws-dock button:not(.is-primary) {
          background: transparent;
          border-color: var(--line);
          color: var(--ink);
        }
        .ws-dock button:not(.is-primary):hover,
        .ws-dock button:not(.is-primary):focus-visible {
          background: var(--bg);
          outline: none;
        }
        .ws-main {
          flex: 1;
          padding: 1rem clamp(0.75rem, 2vw, 1.5rem) 2rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          min-height: calc(100vh - 3.25rem);
        }
        .ws-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 1rem;
        }
        .ws-title {
          font-family: "Sora", system-ui, sans-serif;
          font-size: 1.1rem;
          font-weight: 600;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .ws-count {
          font-size: 0.75rem;
          color: var(--mute);
        }
        .ws-sort {
          display: flex;
          gap: 0.35rem;
        }
        .ws-sort span {
          font-size: 0.7rem;
          color: var(--mute);
          padding: 0.2rem 0.45rem;
          border-radius: 4px;
          cursor: default;
        }
        .ws-sort span.is-on {
          background: var(--surface);
          color: var(--ink);
          border: 1px solid var(--line);
        }
        .ws-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 16.5rem), 1fr));
          gap: 0.85rem;
          flex: 1;
          align-content: start;
        }
        .ws-doc {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 14rem;
          box-shadow: 0 1px 0 rgba(26, 35, 48, 0.04);
          transition: box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease;
          animation: ws-in 420ms ease both;
        }
        .ws-doc:nth-child(2) { animation-delay: 60ms; }
        .ws-doc:hover,
        .ws-doc:focus-within {
          transform: translateY(-2px);
          border-color: #b8c0cc;
          box-shadow: 0 10px 28px rgba(26, 35, 48, 0.08);
        }
        .ws-preview {
          height: 7.5rem;
          background:
            linear-gradient(180deg, #fff 0%, #f0f2f5 100%);
          border-bottom: 1px solid var(--line);
          padding: 0.85rem 1rem;
          position: relative;
        }
        .ws-preview::before {
          content: "";
          display: block;
          height: 0.45rem;
          width: 42%;
          background: var(--ink);
          opacity: 0.85;
          margin-bottom: 0.55rem;
        }
        .ws-preview::after {
          content: "";
          display: block;
          height: 0.28rem;
          width: 78%;
          background: var(--mute);
          opacity: 0.35;
          box-shadow:
            0 0.55rem 0 rgba(102, 112, 133, 0.28),
            0 1.1rem 0 rgba(102, 112, 133, 0.22),
            0 1.65rem 0 rgba(102, 112, 133, 0.18);
        }
        .ws-body {
          padding: 0.85rem 1rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          flex: 1;
        }
        .ws-name {
          font-family: "Sora", system-ui, sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .ws-headline {
          margin: 0;
          font-size: 0.75rem;
          line-height: 1.4;
          color: var(--mute);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ws-meta {
          margin-top: auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.35rem;
          padding-top: 0.55rem;
        }
        .ws-tag {
          font-size: 0.65rem;
          font-weight: 600;
          padding: 0.15rem 0.4rem;
          border-radius: 3px;
          background: var(--bg);
          color: var(--mute);
        }
        .ws-updated {
          margin-left: auto;
          font-size: 0.65rem;
          color: var(--mute);
        }
        .ws-actions {
          display: flex;
          gap: 0.25rem;
          padding: 0 0.65rem 0.65rem;
        }
        .ws-actions button {
          flex: 1;
          font-family: inherit;
          font-size: 0.68rem;
          font-weight: 500;
          border: 1px solid var(--line);
          background: var(--surface);
          border-radius: 4px;
          padding: 0.35rem;
          cursor: pointer;
          color: var(--mute);
        }
        .ws-actions button:hover,
        .ws-actions button:focus-visible {
          color: var(--ink);
          border-color: #b8c0cc;
          outline: none;
        }
        .ws-lock {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: var(--ink);
          color: #fff;
          padding: 0.15rem 0.35rem;
          border-radius: 3px;
        }
        @keyframes ws-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ws-doc { animation: none; }
          .ws-doc:hover { transform: none; }
        }
        @media (max-width: 640px) {
          .ws-dock { gap: 0.5rem; }
          .ws-search { order: 10; flex: 1 1 100%; }
        }
      `}</style>
      <div class="ws">
        <header class="ws-dock">
          <DesignLabBackLink />
          <h1 class="ws-brand">
            <span class="ws-brand-mark" aria-hidden="true">
              R
            </span>
            Rustume
          </h1>
          <span class="ws-local">Local mode</span>
          <div class="ws-spacer" />
          <label class="ws-search">
            <span aria-hidden="true" style={{ "font-size": "0.75rem", color: "var(--mute)" }}>
              ⌕
            </span>
            <input type="search" placeholder="Search resumes…" aria-label="Search resumes" />
          </label>
          <button type="button" class="is-primary">
            Create
          </button>
          <button type="button">Import</button>
        </header>

        <main class="ws-main">
          <div class="ws-head">
            <div>
              <h2 class="ws-title">Your resumes</h2>
              <p class="ws-count">2 documents on this device</p>
            </div>
            <div class="ws-sort" aria-label="Sort">
              <span class="is-on">Updated</span>
              <span>Name</span>
              <span>Created</span>
            </div>
          </div>

          <div class="ws-grid" role="list">
            <For each={SAMPLE_RESUMES}>
              {(r) => (
                <article class="ws-doc" role="listitem">
                  <div class="ws-preview">
                    {r.locked ? <span class="ws-lock">Locked</span> : null}
                  </div>
                  <div class="ws-body">
                    <h3 class="ws-name">{r.name}</h3>
                    <p class="ws-headline">{r.headline}</p>
                    <div class="ws-meta">
                      <For each={r.tags}>
                        {(t) => (
                          <span class="ws-tag">{t}</span>
                        )}
                      </For>
                      <span class="ws-updated">{r.updated}</span>
                    </div>
                  </div>
                  <div class="ws-actions">
                    <button type="button">Open</button>
                    <button type="button">Duplicate</button>
                    <button type="button">Rename</button>
                  </div>
                </article>
              )}
            </For>
          </div>
        </main>
      </div>
    </>
  );
}
