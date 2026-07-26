import { downloadBlob } from "../../api/export";
import { isWasmReady, resumeToJson } from "../../wasm";
import type { ResumeData } from "../../wasm/types";

/** Sanitize a resume name into a safe download filename (without extension). */
export function resumeFileName(resume: ResumeData | null): string {
  const name = resume?.basics.name || "resume";
  // Remove characters that are problematic in filenames
  return (
    name
      .toLowerCase()
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "resume"
  );
}

/** Serialize a resume and trigger a browser download of the JSON file. */
export function downloadResumeJson(resume: ResumeData): void {
  const json = isWasmReady() ? resumeToJson(resume) : JSON.stringify(resume, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, `${resumeFileName(resume)}.json`);
}
