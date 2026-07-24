import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeData } from "../../wasm/types";
import {
  clearUndoHistory,
  noteResumeChanged,
  redoResume,
  undoHistoryStore,
  undoResume,
} from "../undoHistory";

function resumeNamed(name: string): ResumeData {
  return {
    basics: {
      name,
      headline: "",
      email: "",
      phone: "",
      location: "",
      url: { label: "", href: "" },
      customFields: [],
      picture: {
        url: "",
        size: 64,
        aspectRatio: 1,
        borderRadius: 0,
        effects: {
          hidden: true,
          border: false,
          grayscale: false,
          rotation: 0,
          borderColor: "",
          borderWidth: 2,
          shadowColor: "#00000040",
          shadowSize: 0,
        },
      },
    },
    sections: {
      summary: {
        id: "summary",
        name: "Summary",
        columns: 1,
        visible: true,
        separateLinks: true,
        content: "",
      },
      coverLetter: {
        id: "coverLetter",
        name: "Cover Letter",
        visible: false,
        recipient: { name: "", title: "", company: "", address: "", email: "" },
        content: "",
      },
      experience: {
        id: "experience",
        name: "Experience",
        columns: 1,
        visible: true,
        separateLinks: true,
        items: [],
      },
      education: {
        id: "education",
        name: "Education",
        columns: 1,
        visible: true,
        separateLinks: true,
        items: [],
      },
      skills: {
        id: "skills",
        name: "Skills",
        columns: 1,
        visible: true,
        separateLinks: true,
        items: [],
      },
      projects: {
        id: "projects",
        name: "Projects",
        columns: 1,
        visible: true,
        separateLinks: true,
        items: [],
      },
      profiles: {
        id: "profiles",
        name: "Profiles",
        columns: 1,
        visible: true,
        separateLinks: true,
        items: [],
      },
      awards: {
        id: "awards",
        name: "Awards",
        columns: 1,
        visible: true,
        separateLinks: true,
        items: [],
      },
      certifications: {
        id: "certifications",
        name: "Certifications",
        columns: 1,
        visible: true,
        separateLinks: true,
        items: [],
      },
      publications: {
        id: "publications",
        name: "Publications",
        columns: 1,
        visible: true,
        separateLinks: true,
        items: [],
      },
      languages: {
        id: "languages",
        name: "Languages",
        columns: 1,
        visible: true,
        separateLinks: true,
        items: [],
      },
      interests: {
        id: "interests",
        name: "Interests",
        columns: 1,
        visible: true,
        separateLinks: true,
        items: [],
      },
      volunteer: {
        id: "volunteer",
        name: "Volunteer",
        columns: 1,
        visible: true,
        separateLinks: true,
        items: [],
      },
      references: {
        id: "references",
        name: "References",
        columns: 1,
        visible: true,
        separateLinks: true,
        items: [],
      },
      custom: {},
    },
    metadata: {
      template: "onyx",
      layout: [[["summary"]]],
      css: { value: "", visible: false },
      page: { margin: 18, format: "a4", breakLine: true, pageNumbers: false },
      theme: { background: "#ffffff", text: "#000000", primary: "#000000" },
      typography: {
        font: { family: "IBM Plex Serif", subset: "latin", variants: ["regular"], size: 14 },
        lineHeight: 1.5,
        hideIcons: false,
        underlineLinks: false,
      },
      notes: "",
      locked: false,
      tags: [],
    },
  } as ResumeData;
}

describe("undoHistory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearUndoHistory(resumeNamed("start"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces rapid edits into a single undo entry", () => {
    noteResumeChanged(resumeNamed("a"));
    noteResumeChanged(resumeNamed("ab"));
    noteResumeChanged(resumeNamed("abc"));
    expect(undoHistoryStore.state.canUndo).toBe(false);

    vi.advanceTimersByTime(500);
    expect(undoHistoryStore.state.canUndo).toBe(true);

    const undone = undoResume(resumeNamed("abc"));
    expect(undone?.basics.name).toBe("start");
    expect(undoHistoryStore.state.canRedo).toBe(true);

    const redone = redoResume(undone!);
    expect(redone?.basics.name).toBe("abc");
  });

  it("clears history on resume switch", () => {
    noteResumeChanged(resumeNamed("edit"));
    vi.advanceTimersByTime(500);
    expect(undoHistoryStore.state.canUndo).toBe(true);

    clearUndoHistory(resumeNamed("other"));
    expect(undoHistoryStore.state.canUndo).toBe(false);
    expect(undoHistoryStore.state.canRedo).toBe(false);
  });

  it("does not throw when redo is requested during a pending edit burst", () => {
    noteResumeChanged(resumeNamed("edit"));
    vi.advanceTimersByTime(500);
    const undone = undoResume(resumeNamed("edit"));
    expect(undone?.basics.name).toBe("start");
    expect(undoHistoryStore.state.canRedo).toBe(true);

    // Start a new edit burst (pending anchor) without committing the debounce.
    noteResumeChanged(resumeNamed("during-debounce"));
    expect(undoHistoryStore.state.canRedo).toBe(true);

    expect(() => redoResume(resumeNamed("during-debounce"))).not.toThrow();
    expect(undoHistoryStore.state.canRedo).toBe(false);
  });
});
