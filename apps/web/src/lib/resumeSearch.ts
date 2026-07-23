import Fuse from "fuse.js";
import type { ResumeListItem } from "../stores/persistence";

export const RESUME_SEARCH_QUERY_KEY = "rustume:home-resume-search";

export function getStoredSearchQuery(): string {
  try {
    return sessionStorage.getItem(RESUME_SEARCH_QUERY_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredSearchQuery(query: string): void {
  try {
    if (query) {
      sessionStorage.setItem(RESUME_SEARCH_QUERY_KEY, query);
    } else {
      sessionStorage.removeItem(RESUME_SEARCH_QUERY_KEY);
    }
  } catch {
    // sessionStorage may be unavailable in private browsing or tests
  }
}

export interface TextSegment {
  text: string;
  highlighted: boolean;
}

export interface FilteredResumeItem {
  resume: ResumeListItem;
  nameSegments: TextSegment[];
}

function buildHighlightSegments(text: string, indices: readonly [number, number][]): TextSegment[] {
  if (!indices.length) {
    return [{ text, highlighted: false }];
  }

  const sorted = [...indices].sort((a, b) => a[0] - b[0]);
  // Merge overlapping/adjacent ranges so a range starting before the cursor
  // can't duplicate characters across two highlighted segments.
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), highlighted: false });
    }
    segments.push({ text: text.slice(start, end + 1), highlighted: true });
    cursor = end + 1;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false });
  }

  return segments.filter((segment) => segment.text.length > 0);
}

/** Strip diacritics so e.g. "jose" matches "José". */
function foldDiacritics(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

export interface ResumeSearchIndex {
  resumes: ResumeListItem[];
  fuse: Fuse<ResumeListItem>;
}

/** Build a reusable Fuse index over resume title, basics.name, and headline. */
export function createResumeSearchIndex(resumes: ResumeListItem[]): ResumeSearchIndex {
  const fuse = new Fuse(resumes, {
    keys: [
      { name: "name", weight: 2 },
      { name: "basicsName", weight: 2 },
      { name: "headline", weight: 1 },
    ],
    threshold: 0.4,
    includeMatches: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
    getFn: (obj, path) => {
      const key = Array.isArray(path) ? path.join(".") : path;
      const value = (obj as unknown as Record<string, unknown>)[key];
      return typeof value === "string" ? foldDiacritics(value) : "";
    },
  });
  return { resumes, fuse };
}

/**
 * Fuzzy-filter resumes against a prebuilt index and return highlight segments.
 * Highlighting applies to the displayed name only; matches on hidden fields
 * (basics.name, headline) include the item without marks.
 */
export function filterResumes(index: ResumeSearchIndex, query: string): FilteredResumeItem[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return index.resumes.map((resume) => ({
      resume,
      nameSegments: [{ text: resume.name, highlighted: false }],
    }));
  }

  return index.fuse.search(foldDiacritics(trimmed)).map((result) => {
    const nameMatch = result.matches?.find((match) => match.key === "name");
    const nameSegments = nameMatch
      ? buildHighlightSegments(result.item.name, nameMatch.indices)
      : [{ text: result.item.name, highlighted: false }];

    return { resume: result.item, nameSegments };
  });
}
