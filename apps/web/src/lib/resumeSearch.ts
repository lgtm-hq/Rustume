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

function buildHighlightSegments(
  text: string,
  indices: readonly [number, number][],
): TextSegment[] {
  if (!indices.length) {
    return [{ text, highlighted: false }];
  }

  const sorted = [...indices].sort((a, b) => a[0] - b[0]);
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const [start, end] of sorted) {
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

/** Fuzzy-filter resumes by title/name and return highlight segments for matches. */
export function filterResumes(
  resumes: ResumeListItem[],
  query: string,
): FilteredResumeItem[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return resumes.map((resume) => ({
      resume,
      nameSegments: [{ text: resume.name, highlighted: false }],
    }));
  }

  const fuse = new Fuse(resumes, {
    keys: ["name"],
    threshold: 0.4,
    includeMatches: true,
    ignoreLocation: true,
  });

  return fuse.search(trimmed).map((result) => {
    const nameMatch = result.matches?.find((match) => match.key === "name");
    const nameSegments = nameMatch
      ? buildHighlightSegments(result.item.name, nameMatch.indices)
      : [{ text: result.item.name, highlighted: false }];

    return { resume: result.item, nameSegments };
  });
}
