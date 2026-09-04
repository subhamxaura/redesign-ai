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

function readString(
  record: UnknownRecord,
  key: string,
  fallback: string
) {
  const value = record[key];

  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeHexColor(value: unknown, fallback: string) {
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
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return {
    title: readString(record, "title", fallbackRedesign.title),
    subtitle: readString(record, "subtitle", fallbackRedesign.subtitle),
    description: readString(
      record,
      "description",
      fallbackRedesign.description
    ),
    primaryButton: readString(
      record,
      "primaryButton",
      fallbackRedesign.primaryButton
    ),
    secondaryButton: readString(
      record,
      "secondaryButton",
      fallbackRedesign.secondaryButton
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
    layout: readString(record, "layout", fallbackRedesign.layout),
    designStyle: readString(
      record,
      "designStyle",
      fallbackRedesign.designStyle
    ),
    improvements:
      improvements.length > 0 ? improvements : fallbackRedesign.improvements,
  };
}

export function parseRedesignSpecJson(text: string): RedesignSpec {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  return coerceRedesignSpec(JSON.parse(cleaned));
}
