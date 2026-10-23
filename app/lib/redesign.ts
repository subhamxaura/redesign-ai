import { AppError } from "@/app/lib/errors";

export type RedesignTheme = {
  background: string;
  surface: string;
  accent: string;
  text: string;
};

export type RedesignSpec = {
  title: string;
  subtitle: string;
  description: string;
  primaryButton: string;
  secondaryButton: string;
  theme: RedesignTheme;
  layout: string;
  designStyle: string;
  improvements: string[];
};

const MAX_REDESIGN_JSON_CHARS = 50_000;
const MAX_TITLE_CHARS = 200;
const MAX_SUBTITLE_CHARS = 400;
const MAX_DESCRIPTION_CHARS = 2_000;
const MAX_BUTTON_CHARS = 80;
const MAX_LAYOUT_CHARS = 4_000;
const MAX_STYLE_CHARS = 2_000;
const MAX_IMPROVEMENT_CHARS = 400;
const MAX_IMPROVEMENTS = 6;

const defaultTheme: RedesignTheme = {
  background: "#08111f",
  surface: "#0f1d2e",
  accent: "#22d3ee",
  text: "#f8fafc",
};

const fallbackRedesign: RedesignSpec = {
  title: "A clearer, faster website experience",
  subtitle: "A modern redesign focused on hierarchy, trust, and conversion.",
  description:
    "This concept keeps the original purpose while improving spacing, content rhythm, accessibility, and responsive behavior.",
  primaryButton: "Start now",
  secondaryButton: "View details",
  theme: defaultTheme,
  layout:
    "Use a focused hero, compact navigation, clear content sections, and responsive grids that collapse cleanly on mobile.",
  designStyle:
    "Polished product-led interface with strong contrast, generous spacing, crisp typography, and restrained accent color.",
  improvements: [
    "Clarify the primary action and keep secondary actions visually quieter.",
    "Increase spacing around important content so the page is easier to scan.",
    "Improve text contrast and button states for better accessibility.",
  ],
};

export const redesignResponseSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    description: { type: "string" },
    primaryButton: { type: "string" },
    secondaryButton: { type: "string" },
    theme: {
      type: "object",
      properties: {
        background: { type: "string" },
        surface: { type: "string" },
        accent: { type: "string" },
        text: { type: "string" },
      },
      required: ["background", "surface", "accent", "text"],
    },
    layout: { type: "string" },
    designStyle: { type: "string" },
    improvements: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "title",
    "subtitle",
    "description",
    "primaryButton",
    "secondaryButton",
    "theme",
    "layout",
    "designStyle",
    "improvements",
  ],
} as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: string, maxChars: number): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxChars);
}

function readString(
  record: UnknownRecord,
  key: string,
  fallback: string,
  maxChars: number
): string {
  const value = record[key];

  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = cleanText(value, maxChars);
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  const shortHex = /^#([0-9a-fA-F]{3})$/.exec(trimmed);

  if (shortHex) {
    return `#${shortHex[1]
      .split("")
      .map((part) => `${part}${part}`)
      .join("")}`;
  }

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed;
  }

  return fallback;
}

export function coerceRedesignSpec(value: unknown): RedesignSpec {
  const record = isRecord(value) ? value : {};
  const theme = isRecord(record.theme) ? record.theme : {};
  const surfaceFallback = normalizeHexColor(
    theme.card,
    fallbackRedesign.theme.surface
  );
  const improvements = Array.isArray(record.improvements)
    ? record.improvements
        .filter((item): item is string => typeof item === "string")
        .map((item) => cleanText(item, MAX_IMPROVEMENT_CHARS))
        .filter(Boolean)
        .slice(0, MAX_IMPROVEMENTS)
    : [];

  return {
    title: readString(record, "title", fallbackRedesign.title, MAX_TITLE_CHARS),
    subtitle: readString(
      record,
      "subtitle",
      fallbackRedesign.subtitle,
      MAX_SUBTITLE_CHARS
    ),
    description: readString(
      record,
      "description",
      fallbackRedesign.description,
      MAX_DESCRIPTION_CHARS
    ),
    primaryButton: readString(
      record,
      "primaryButton",
      fallbackRedesign.primaryButton,
      MAX_BUTTON_CHARS
    ),
    secondaryButton: readString(
      record,
      "secondaryButton",
      fallbackRedesign.secondaryButton,
      MAX_BUTTON_CHARS
    ),
    theme: {
      background: normalizeHexColor(
        theme.background,
        fallbackRedesign.theme.background
      ),
      surface: normalizeHexColor(theme.surface, surfaceFallback),
      accent: normalizeHexColor(theme.accent, fallbackRedesign.theme.accent),
      text: normalizeHexColor(theme.text, fallbackRedesign.theme.text),
    },
    layout: readString(record, "layout", fallbackRedesign.layout, MAX_LAYOUT_CHARS),
    designStyle: readString(
      record,
      "designStyle",
      fallbackRedesign.designStyle,
      MAX_STYLE_CHARS
    ),
    improvements:
      improvements.length > 0 ? improvements : fallbackRedesign.improvements,
  };
}

export function parseRedesignSpecJson(text: string): RedesignSpec {
  if (text.length > MAX_REDESIGN_JSON_CHARS) {
    throw new AppError(502, "The AI service returned an oversized redesign.");
  }

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  if (!cleaned || cleaned.length > MAX_REDESIGN_JSON_CHARS) {
    throw new AppError(502, "The AI service returned an invalid redesign.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AppError(502, "The AI service returned an invalid redesign.");
  }

  if (!isRecord(parsed)) {
    throw new AppError(502, "The AI service returned an invalid redesign.");
  }

  return coerceRedesignSpec(parsed);
}
