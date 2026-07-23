import type { ResumeListItem } from "../stores/persistence";

export type ResumeSortMode = "updated" | "created" | "name-asc" | "name-desc";

const SORT_STORAGE_KEY = "rustume-resume-sort";

const SORT_LABELS: Record<ResumeSortMode, string> = {
  updated: "Last updated",
  created: "Date created",
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
};

export function getResumeSortLabels(): { value: ResumeSortMode; label: string }[] {
  return (Object.keys(SORT_LABELS) as ResumeSortMode[]).map((value) => ({
    value,
    label: SORT_LABELS[value],
  }));
}

export function getStoredResumeSort(): ResumeSortMode {
  if (typeof localStorage === "undefined") return "updated";
  const raw = localStorage.getItem(SORT_STORAGE_KEY);
  if (raw === "updated" || raw === "created" || raw === "name-asc" || raw === "name-desc") {
    return raw;
  }
  return "updated";
}

export function setStoredResumeSort(mode: ResumeSortMode): void {
  localStorage.setItem(SORT_STORAGE_KEY, mode);
}

export function sortResumes<T extends ResumeListItem>(items: T[], mode: ResumeSortMode): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    switch (mode) {
      case "created": {
        const aTime = (a.createdAt ?? a.updatedAt).getTime();
        const bTime = (b.createdAt ?? b.updatedAt).getTime();
        return bTime - aTime;
      }
      case "name-asc":
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      case "name-desc":
        return b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
      case "updated":
      default:
        return b.updatedAt.getTime() - a.updatedAt.getTime();
    }
  });
  return copy;
}
