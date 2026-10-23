import { NextResponse } from "next/server";
import { errorResponse, enforceOrRateLimit, noStoreJson } from "@/app/lib/api";
import {
  generateGeminiContent,
  GEMINI_MODEL,
  getGeminiClient,
  readGeminiResponseText,
} from "@/app/lib/gemini";
import {
  fileToInlineData,
  validateImageUpload,
} from "@/app/lib/imageValidation";
import { assertSameOrigin, getRateLimitIdentity, readFormDataWithLimit } from "@/app/lib/http";
import { MAX_ANALYSIS_OUTPUT_CHARS } from "@/app/lib/validation";

export const runtime = "nodejs";

const analysisPrompt = `
You are an expert UI/UX designer, product designer, and senior frontend developer.

Analyze the uploaded image carefully.

IMPORTANT RULES:

1. Determine what type of visual this is:
   - Website screenshot
   - Mobile app interface
   - Dashboard
   - Landing page
   - Illustration
   - Poster
   - Other visual

2. If it is a website or application screenshot:
   - Analyze only what is actually visible.
   - Do not invent elements that cannot reasonably be seen.
   - Pay attention to layout, spacing, typography, colors, components, navigation, imagery, and hierarchy.

3. If it is not a website or application screenshot:
   - Clearly explain what type of visual it is.
   - Then provide useful recommendations for incorporating its visual style into a modern website.

Provide the analysis using exactly this structure:

## 1. Visual Analysis

Describe:
- Overall layout
- Composition
- Spacing
- Colors
- Typography
- Visual hierarchy
- Images/graphics
- Components
- Overall design style

## 2. Current Design Problems

List the most important visible design weaknesses.

Focus on specific problems rather than generic advice.

## 3. UX Problems

Identify reasonably inferable problems related to:
- Navigation
- Usability
- Accessibility
- Information hierarchy
- User flow
- Responsiveness
- Interaction
- Mobile experience

Only mention problems that can reasonably be inferred from the screenshot.

## 4. UI Improvements

Give specific recommendations for:

### Layout
### Spacing
### Typography
### Colors
### Buttons
### Navigation
### Cards and Components
### Images
### Responsive Design

Make each recommendation practical and specific.

## 5. Modern Redesign Concept

Describe a polished, modern redesign.

Preserve:
- The original purpose
- Important content
- Important branding/visual identity

Improve:
- Visual hierarchy
- Usability
- Modern aesthetics
- Responsiveness
- Accessibility

## 6. Developer Implementation Plan

Give practical implementation guidance for a developer using:
- Next.js
- React
- TypeScript
- Tailwind CSS

Mention useful component structure, responsive breakpoints, reusable components, and accessibility considerations.

Keep the recommendations directly connected to what is visible in the uploaded image. Do not give vague generic advice.
`;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const rateLimitKey = getRateLimitIdentity(request);
    const limited = await enforceOrRateLimit([
      { key: `analyze:${rateLimitKey}`, limit: 20, windowSeconds: 60 * 60 },
    ]);
    if (limited) return limited;

    const formData = await readFormDataWithLimit(request);
    const image = await validateImageUpload(formData.get("image"));

    if (!image.ok) {
      return NextResponse.json({ error: image.error }, { status: image.status });
    }

    const ai = getGeminiClient();
    const response = await generateGeminiContent(ai, {
      model: GEMINI_MODEL,
      contents: [
        fileToInlineData(image.buffer, image.mimeType),
        { text: analysisPrompt },
      ],
    });
    const analysis = readGeminiResponseText(response, MAX_ANALYSIS_OUTPUT_CHARS);

    return noStoreJson({
      success: true,
      analysis,
    });
  } catch (error: unknown) {
    return errorResponse(error, "Failed to analyze the image.");
  }
}
