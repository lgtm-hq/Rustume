import { A } from "@solidjs/router";
import { onCleanup, onMount, type JSX } from "solid-js";

export type SampleResume = {
  id: string;
  name: string;
  headline: string;
  updated: string;
  tags: string[];
  locked?: boolean;
};

export const SAMPLE_RESUMES: SampleResume[] = [
  {
    id: "r1",
    name: "Eitel Dagnin",
    headline: "Automation & Platform Engineer | AI-native workflows in production",
    updated: "2h ago",
    tags: ["production", "local"],
  },
  {
    id: "r2",
    name: "Eitel Dagnin — Staff track",
    headline: "Platform engineering · Rust, TypeScript, offline-first systems",
    updated: "Yesterday",
    tags: ["draft"],
    locked: true,
  },
];

const FONT_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Instrument+Serif:ital@0;1",
    "family=Public+Sans:wght@400;500;600;700",
    "family=Sora:wght@400;500;600;700",
    "family=IBM+Plex+Sans:wght@400;500;600",
    "family=Syne:wght@500;600;700;800",
    "family=Source+Sans+3:wght@400;500;600;700",
    "family=Space+Grotesk:wght@400;500;600;700",
    "family=JetBrains+Mono:wght@400;500;600",
    "family=Big+Shoulders+Display:wght@500;600;700;800",
    "family=Manrope:wght@400;500;600;700;800",
    "family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700",
  ].join("&") +
  "&display=swap";

/** Inject Google Fonts once for design-lab prototypes. */
export function useDesignLabFonts(): void {
  onMount(() => {
    const existing = document.querySelector(`link[data-design-lab-fonts]`);
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    link.setAttribute("data-design-lab-fonts", "true");
    document.head.appendChild(link);
  });
}

export function DesignLabBackLink(props: { tone?: "light" | "dark" }): JSX.Element {
  const tone = () => props.tone ?? "dark";
  return (
    <A
      href="/design-lab"
      class="dl-back"
      classList={{ "dl-back--light": tone() === "light", "dl-back--dark": tone() === "dark" }}
    >
      ← Design lab
    </A>
  );
}

/** Shared reduced-motion + back-link baseline used by every prototype. */
export const DESIGN_LAB_BASE_CSS = `
  .dl-back {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-decoration: none;
    opacity: 0.75;
    transition: opacity 160ms ease;
  }
  .dl-back:hover,
  .dl-back:focus-visible {
    opacity: 1;
    outline: none;
  }
  .dl-back--dark { color: inherit; }
  .dl-back--light { color: #f5f5f5; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export function useDesignLabMount(title: string): void {
  useDesignLabFonts();
  onMount(() => {
    const prev = document.title;
    document.title = `${title} · Design lab · Rustume`;
    onCleanup(() => {
      document.title = prev;
    });
  });
}
