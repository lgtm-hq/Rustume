import type { ResumeData } from "./types";
import { generateId } from "./types";

/**
 * Creates a sample resume with realistic placeholder data.
 * Used for preview when user's resume is empty.
 */
export function createSampleResume(): ResumeData {
  return {
    basics: {
      name: "Alex Johnson",
      headline: "Senior Software Engineer",
      email: "alex.johnson@example.com",
      phone: "+1 (555) 123-4567",
      location: "San Francisco, CA",
      url: { label: "Portfolio", href: "https://alexjohnson.dev" },
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
        },
      },
    },
    sections: {
      summary: {
        id: "summary",
        name: "Summary",
        columns: 1,
        separateLinks: false,
        visible: true,
        content:
          "Passionate software engineer with 8+ years of experience building scalable web applications. Expert in React, TypeScript, and cloud architecture. Led teams of 5-10 engineers and delivered products serving millions of users.",
      },
      experience: {
        id: "experience",
        name: "Experience",
        columns: 1,
        separateLinks: false,
        visible: true,
        items: [
          {
            id: generateId(),
            visible: true,
            company: "TechCorp Inc.",
            position: "Senior Software Engineer",
            location: "San Francisco, CA",
            date: "2020 - Present",
            summary:
              "Lead development of the core platform serving 2M+ daily active users. Architected microservices infrastructure reducing latency by 40%. Mentor junior developers and conduct code reviews.",
            url: { label: "", href: "" },
          },
          {
            id: generateId(),
            visible: true,
            company: "StartupXYZ",
            position: "Software Engineer",
            location: "Remote",
            date: "2017 - 2020",
            summary:
              "Built real-time collaboration features from scratch. Implemented CI/CD pipelines reducing deployment time by 70%. Contributed to open-source tools used by the developer community.",
            url: { label: "", href: "" },
          },
        ],
      },
      education: {
        id: "education",
        name: "Education",
        columns: 1,
        separateLinks: false,
        visible: true,
        items: [
          {
            id: generateId(),
            visible: true,
            institution: "Stanford University",
            area: "Computer Science",
            studyType: "Bachelor of Science",
            date: "2013 - 2017",
            score: "GPA: 3.9/4.0",
            summary: "",
            url: { label: "", href: "" },
          },
        ],
      },
      skills: {
        id: "skills",
        name: "Skills",
        columns: 2,
        separateLinks: false,
        visible: true,
        items: [
          {
            id: generateId(),
            visible: true,
            name: "TypeScript / JavaScript",
            description: "",
            level: 5,
            keywords: [],
          },
          {
            id: generateId(),
            visible: true,
            name: "React / Next.js",
            description: "",
            level: 5,
            keywords: [],
          },
          {
            id: generateId(),
            visible: true,
            name: "Node.js / Python",
            description: "",
            level: 4,
            keywords: [],
          },
          {
            id: generateId(),
            visible: true,
            name: "PostgreSQL / Redis",
            description: "",
            level: 4,
            keywords: [],
          },
        ],
      },
      projects: {
        id: "projects",
        name: "Projects",
        columns: 1,
        separateLinks: false,
        visible: true,
        items: [],
      },
      profiles: {
        id: "profiles",
        name: "Profiles",
        columns: 2,
        separateLinks: false,
        visible: true,
        items: [],
      },
      awards: {
        id: "awards",
        name: "Awards",
        columns: 1,
        separateLinks: false,
        visible: false,
        items: [],
      },
      certifications: {
        id: "certifications",
        name: "Certifications",
        columns: 1,
        separateLinks: false,
        visible: false,
        items: [],
      },
      publications: {
        id: "publications",
        name: "Publications",
        columns: 1,
        separateLinks: false,
        visible: false,
        items: [],
      },
      languages: {
        id: "languages",
        name: "Languages",
        columns: 2,
        separateLinks: false,
        visible: false,
        items: [],
      },
      interests: {
        id: "interests",
        name: "Interests",
        columns: 2,
        separateLinks: false,
        visible: false,
        items: [],
      },
      volunteer: {
        id: "volunteer",
        name: "Volunteer",
        columns: 1,
        separateLinks: false,
        visible: false,
        items: [],
      },
      references: {
        id: "references",
        name: "References",
        columns: 1,
        separateLinks: false,
        visible: false,
        items: [],
      },
      custom: {},
    },
    metadata: {
      template: "rhyhorn",
      layout: [
        [
          ["summary", "experience", "education"],
          ["skills", "projects", "profiles"],
        ],
      ],
      css: {
        value: "",
        visible: false,
      },
      page: {
        margin: 18,
        format: "a4",
        breakLine: true,
        pageNumbers: true,
      },
      theme: {
        background: "#ffffff",
        text: "#000000",
        primary: "#dc2626",
      },
      typography: {
        font: {
          family: "IBM Plex Sans",
          subset: "latin",
          variants: ["regular", "500", "600", "700"],
          size: 14,
        },
        lineHeight: 1.5,
        hideIcons: false,
        underlineLinks: false,
      },
      notes: "",
    },
  };
}

/**
 * Creates a default resume with sample data pre-filled.
 * Used when creating a new resume.
 */
export function createDefaultResume(): ResumeData {
  return {
    basics: {
      name: "John Doe",
      headline: "Senior Software Engineer",
      email: "john@example.com",
      phone: "+1 (555) 123-4567",
      location: "San Francisco, CA",
      url: { label: "Portfolio", href: "https://johndoe.com" },
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
        },
      },
    },
    sections: {
      summary: {
        id: "summary",
        name: "Summary",
        columns: 1,
        separateLinks: false,
        visible: true,
        content:
          "Experienced software engineer with a passion for building great products. Strong background in full-stack development, cloud architecture, and team leadership.",
      },
      experience: {
        id: "experience",
        name: "Experience",
        columns: 1,
        separateLinks: false,
        visible: true,
        items: [
          {
            id: generateId(),
            visible: true,
            company: "Tech Company",
            position: "Senior Software Engineer",
            location: "San Francisco, CA",
            date: "2020 - Present",
            summary:
              "Lead development of core platform features serving millions of users. Mentored junior developers and established best practices.",
            url: { label: "", href: "" },
          },
          {
            id: generateId(),
            visible: true,
            company: "Startup Inc.",
            position: "Software Engineer",
            location: "Remote",
            date: "2017 - 2020",
            summary:
              "Built and scaled microservices architecture. Reduced API response times by 60% through optimization.",
            url: { label: "", href: "" },
          },
        ],
      },
      education: {
        id: "education",
        name: "Education",
        columns: 1,
        separateLinks: false,
        visible: true,
        items: [
          {
            id: generateId(),
            visible: true,
            institution: "University of Technology",
            area: "Computer Science",
            studyType: "Bachelor of Science",
            date: "2013 - 2017",
            score: "GPA: 3.8/4.0",
            summary: "",
            url: { label: "", href: "" },
          },
        ],
      },
      skills: {
        id: "skills",
        name: "Skills",
        columns: 2,
        separateLinks: false,
        visible: true,
        items: [
          {
            id: generateId(),
            visible: true,
            name: "JavaScript/TypeScript",
            description: "",
            level: 5,
            keywords: [],
          },
          {
            id: generateId(),
            visible: true,
            name: "React",
            description: "",
            level: 5,
            keywords: [],
          },
          {
            id: generateId(),
            visible: true,
            name: "Node.js",
            description: "",
            level: 4,
            keywords: [],
          },
          {
            id: generateId(),
            visible: true,
            name: "PostgreSQL",
            description: "",
            level: 4,
            keywords: [],
          },
        ],
      },
      projects: {
        id: "projects",
        name: "Projects",
        columns: 1,
        separateLinks: false,
        visible: true,
        items: [],
      },
      profiles: {
        id: "profiles",
        name: "Profiles",
        columns: 2,
        separateLinks: false,
        visible: true,
        items: [],
      },
      awards: {
        id: "awards",
        name: "Awards",
        columns: 1,
        separateLinks: false,
        visible: false,
        items: [],
      },
      certifications: {
        id: "certifications",
        name: "Certifications",
        columns: 1,
        separateLinks: false,
        visible: false,
        items: [],
      },
      publications: {
        id: "publications",
        name: "Publications",
        columns: 1,
        separateLinks: false,
        visible: false,
        items: [],
      },
      languages: {
        id: "languages",
        name: "Languages",
        columns: 2,
        separateLinks: false,
        visible: false,
        items: [],
      },
      interests: {
        id: "interests",
        name: "Interests",
        columns: 2,
        separateLinks: false,
        visible: false,
        items: [],
      },
      volunteer: {
        id: "volunteer",
        name: "Volunteer",
        columns: 1,
        separateLinks: false,
        visible: false,
        items: [],
      },
      references: {
        id: "references",
        name: "References",
        columns: 1,
        separateLinks: false,
        visible: false,
        items: [],
      },
      custom: {},
    },
    metadata: {
      template: "rhyhorn",
      layout: [
        [
          ["summary", "experience", "education"],
          ["skills", "projects", "profiles"],
        ],
      ],
      css: {
        value: "",
        visible: false,
      },
      page: {
        margin: 18,
        format: "a4",
        breakLine: true,
        pageNumbers: true,
      },
      theme: {
        background: "#ffffff",
        text: "#000000",
        primary: "#dc2626",
      },
      typography: {
        font: {
          family: "IBM Plex Sans",
          subset: "latin",
          variants: ["regular", "500", "600", "700"],
          size: 14,
        },
        lineHeight: 1.5,
        hideIcons: false,
        underlineLinks: false,
      },
      notes: "",
    },
  };
}
