import type { ResumeData, ValidationResult } from "./types";
import { createDefaultResume } from "./defaults";

// Type definitions for WASM module
interface WasmModule {
  default: () => Promise<void>;
  Storage: new (dbName: string) => WasmStorage;
  parse_json_resume: (input: string) => ResumeData;
  parse_reactive_resume_v3: (input: string) => ResumeData;
  parse_linkedin_export: (data: Uint8Array) => ResumeData;
  validate_resume: (input: string) => ValidationResult;
  create_empty_resume: () => ResumeData;
  resume_to_json: (resume: ResumeData) => string;
  list_templates: () => string[];
  get_template_theme_js: (
    template: string
  ) => { background: string; text: string; primary: string } | null;
}

interface WasmStorage {
  list: () => Promise<string[]>;
  get: (id: string) => Promise<ResumeData>;
  save: (id: string, data: ResumeData) => Promise<void>;
  delete: (id: string) => Promise<void>;
  exists: (id: string) => Promise<boolean>;
}

// WASM module - lazily initialized
let wasmModule: WasmModule | null = null;
let storageInstance: WasmStorage | null = null;
let wasmLoadError: Error | null = null;

export async function initWasm(): Promise<void> {
  if (wasmModule) return;
  if (wasmLoadError) throw wasmLoadError;

  try {
    // Dynamic import - will fail gracefully if WASM not built
    const wasm = (await import("../../wasm/rustume_wasm")) as WasmModule;
    await wasm.default();
    wasmModule = wasm;
  } catch (e) {
    wasmLoadError = e instanceof Error ? e : new Error(String(e));
    console.warn("WASM not available:", e);
    throw wasmLoadError;
  }
}

export function isWasmReady(): boolean {
  return wasmModule !== null;
}

export function getWasmError(): Error | null {
  return wasmLoadError;
}

// Storage operations
export async function getStorage(): Promise<WasmStorage> {
  if (!wasmModule) {
    throw new Error("WASM not initialized");
  }
  if (!storageInstance) {
    storageInstance = new wasmModule.Storage("rustume");
  }
  return storageInstance;
}

export async function listResumes(): Promise<string[]> {
  const storage = await getStorage();
  return storage.list();
}

export async function getResume(id: string): Promise<ResumeData> {
  const storage = await getStorage();
  return storage.get(id);
}

export async function saveResume(
  id: string,
  data: ResumeData
): Promise<void> {
  const storage = await getStorage();
  return storage.save(id, data);
}

export async function deleteResume(id: string): Promise<void> {
  const storage = await getStorage();
  return storage.delete(id);
}

export async function resumeExists(id: string): Promise<boolean> {
  const storage = await getStorage();
  return storage.exists(id);
}

// Parser operations
export function parseJsonResume(input: string): ResumeData {
  if (!wasmModule) {
    throw new Error("WASM not initialized");
  }
  return wasmModule.parse_json_resume(input);
}

export function parseReactiveResumeV3(input: string): ResumeData {
  if (!wasmModule) {
    throw new Error("WASM not initialized");
  }
  return wasmModule.parse_reactive_resume_v3(input);
}

export function parseLinkedInExport(data: Uint8Array): ResumeData {
  if (!wasmModule) {
    throw new Error("WASM not initialized");
  }
  return wasmModule.parse_linkedin_export(data);
}

// Utility operations
export function validateResume(input: string): ValidationResult {
  if (!wasmModule) {
    throw new Error("WASM not initialized");
  }
  return wasmModule.validate_resume(input);
}

export function createEmptyResume(): ResumeData {
  if (wasmModule) {
    return wasmModule.create_empty_resume();
  }
  // Fallback when WASM not available
  return createDefaultResume();
}

export function resumeToJson(resume: ResumeData): string {
  if (wasmModule) {
    return wasmModule.resume_to_json(resume);
  }
  // Fallback
  return JSON.stringify(resume, null, 2);
}

// Template operations
export function listTemplates(): string[] {
  if (wasmModule) {
    return wasmModule.list_templates();
  }
  // Fallback
  return ["rhyhorn", "azurill", "pikachu", "nosepass"];
}

export function getTemplateTheme(
  template: string
): { background: string; text: string; primary: string } | null {
  if (wasmModule) {
    return wasmModule.get_template_theme_js(template);
  }
  // Fallback themes
  const themes: Record<
    string,
    { background: string; text: string; primary: string }
  > = {
    rhyhorn: { background: "#ffffff", text: "#000000", primary: "#0284c7" },
    azurill: { background: "#ffffff", text: "#1e293b", primary: "#2563eb" },
    pikachu: { background: "#fffbeb", text: "#1c1917", primary: "#ca8a04" },
    nosepass: { background: "#f8fafc", text: "#0f172a", primary: "#4f46e5" },
  };
  return themes[template] || null;
}

// Re-export types
export * from "./types";
