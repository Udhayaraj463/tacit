import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export interface DynamicVenue {
  id: string;
  name: string;
  short: string;
  icon: string;
  accent: string;
  gradient: string;
  expectedQuestions: string[];
  initialCards: {
    id: string;
    labelUser: Record<string, string>;
    labelClerk: Record<string, string>;
  }[];
}

export async function generateVenueProfile(
  locationInput: string,
  targetCountryOrCity: string = "Taiwan"
): Promise<DynamicVenue | null> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const prompt = `
    Analyze this location for an Augmentative and Alternative Communication (AAC) app used by non-verbal or disabled travelers:
    Location: "${locationInput}" (Region: ${targetCountryOrCity})

    Generate a complete venue profile as JSON with this exact structure:
    {
      "id": "unique_lowercase_slug",
      "name": "Full Venue Name",
      "short": "Max 6 char short name",
      "icon": "Single appropriate emoji",
      "accent": "Hex color that fits this venue (e.g. #0A84FF)",
      "gradient": "CSS radial-gradient string matching Apple dark mode liquid aesthetic",
      "expectedQuestions": ["3-5 common phrases staff/clerk ask in this place"],
      "initialCards": [
        {
          "id": "c1",
          "labelUser": {
            "en-US": "English text for user",
            "zh-TW": "Traditional Chinese text",
            "ta-IN": "Tamil text",
            "ja-JP": "Japanese text"
          },
          "labelClerk": {
            "en-US": "English phrase for clerk",
            "zh-TW": "Traditional Chinese phrase for clerk",
            "ta-IN": "Tamil phrase for clerk",
            "ja-JP": "Japanese phrase for clerk"
          }
        }
      ]
    }

    Include at least 4 critical initialCards covering:
    1. Disability / Non-verbal notice or primary request
    2. Common transaction or inquiry
    3. Payment / Ticket / ID presentation
    4. Polite wrap-up or allergy/safety notice
  `;

  try {
    const res = await model.generateContent(prompt);
    const parsed = JSON.parse(res.response.text());
    return parsed as DynamicVenue;
  } catch (err) {
    console.error("Failed to generate dynamic venue:", err);
    return null;
  }
}