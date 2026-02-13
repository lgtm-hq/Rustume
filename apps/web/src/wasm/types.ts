// TypeScript types matching the Rust ResumeData schema

export interface Url {
  label: string;
  href: string;
}

export interface CustomField {
  id: string;
  icon: string;
  name: string;
  value: string;
}

export interface Picture {
  url: string;
  size: number;
  aspectRatio: number;
  borderRadius: number;
  effects: {
    hidden: boolean;
    border: boolean;
    grayscale: boolean;
  };
}

export interface Basics {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  url: Url;
  customFields: CustomField[];
  picture: Picture;
}

export interface SummarySection {
  id: string;
  name: string;
  columns: number;
  separateLinks: boolean;
  visible: boolean;
  content: string;
}

export interface Section<T> {
  id: string;
  name: string;
  columns: number;
  separateLinks: boolean;
  visible: boolean;
  items: T[];
}

export interface Experience {
  id: string;
  visible: boolean;
  company: string;
  position: string;
  location: string;
  date: string;
  summary: string;
  url: Url;
}

export interface Education {
  id: string;
  visible: boolean;
  institution: string;
  area: string;
  studyType: string;
  date: string;
  score: string;
  summary: string;
  url: Url;
}

export interface Skill {
  id: string;
  visible: boolean;
  name: string;
  description: string;
  level: number;
  keywords: string[];
}

export interface Project {
  id: string;
  visible: boolean;
  name: string;
  description: string;
  date: string;
  summary: string;
  keywords: string[];
  url: Url;
}

export interface Profile {
  id: string;
  visible: boolean;
  network: string;
  username: string;
  icon: string;
  url: Url;
}

export interface Award {
  id: string;
  visible: boolean;
  title: string;
  awarder: string;
  date: string;
  summary: string;
  url: Url;
}

export interface Certification {
  id: string;
  visible: boolean;
  name: string;
  issuer: string;
  date: string;
  summary: string;
  url: Url;
}

export interface Publication {
  id: string;
  visible: boolean;
  name: string;
  publisher: string;
  date: string;
  summary: string;
  url: Url;
}

export interface Language {
  id: string;
  visible: boolean;
  name: string;
  description: string;
  level: number;
}

export interface Interest {
  id: string;
  visible: boolean;
  name: string;
  keywords: string[];
}

export interface Volunteer {
  id: string;
  visible: boolean;
  organization: string;
  position: string;
  location: string;
  date: string;
  summary: string;
  url: Url;
}

export interface Reference {
  id: string;
  visible: boolean;
  name: string;
  description: string;
  summary: string;
  url: Url;
}

export interface CustomItem {
  id: string;
  visible: boolean;
  name: string;
  description: string;
  date: string;
  location: string;
  summary: string;
  keywords: string[];
  url: Url;
}

export interface Sections {
  summary: SummarySection;
  experience: Section<Experience>;
  education: Section<Education>;
  skills: Section<Skill>;
  projects: Section<Project>;
  profiles: Section<Profile>;
  awards: Section<Award>;
  certifications: Section<Certification>;
  publications: Section<Publication>;
  languages: Section<Language>;
  interests: Section<Interest>;
  volunteer: Section<Volunteer>;
  references: Section<Reference>;
  custom: Record<string, Section<CustomItem>>;
}

export interface CustomCss {
  value: string;
  visible: boolean;
}

export interface PageConfig {
  margin: number;
  format: "a4" | "letter";
  breakLine: boolean;
  pageNumbers: boolean;
}

export interface Theme {
  preset?: string;
  background: string;
  text: string;
  primary: string;
}

export interface ThemePresetInfo {
  id: string;
  name: string;
  isDark: boolean;
  colors: {
    background: string;
    text: string;
    primary: string;
  };
}

export interface Typography {
  font: {
    family: string;
    subset: string;
    variants: string[];
    size: number;
  };
  lineHeight: number;
  hideIcons: boolean;
  underlineLinks: boolean;
}

export interface Metadata {
  template: string;
  layout: string[][][];
  css: CustomCss;
  page: PageConfig;
  theme: Theme;
  typography: Typography;
  notes: string;
}

export interface ResumeData {
  basics: Basics;
  sections: Sections;
  metadata: Metadata;
}

export interface TemplateInfo {
  id: string;
  name: string;
  theme: Theme;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// Helper to create default empty values
export function createEmptyUrl(): Url {
  return { label: "", href: "" };
}

export function createEmptyPicture(): Picture {
  return {
    url: "",
    size: 64,
    aspectRatio: 1,
    borderRadius: 0,
    effects: {
      hidden: true,
      border: false,
      grayscale: false,
    },
  };
}

export function generateId(): string {
  return crypto.randomUUID();
}
