import { GoogleGenerativeAI } from '@google/generative-ai';

// Eliminates the TypeScript red line on process.env without needing extra packages
declare const process: { env: { [key: string]: string | undefined } };

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
  },
});

export interface ActionCardItem {
  id: string;
  title: string;
  subtitle: string;
  clerkDisplayText: string;
}

export interface CognitiveResponse {
  detectedClerkQuestion: string;
  cards: ActionCardItem[];
}

export async function processClerkAudio(
  transcribedText: string,
  venueContext: string
): Promise<CognitiveResponse | null> {
  if (!transcribedText.trim()) return null;

  try {
    const prompt = `
      You are the cognitive engine for "Tacit 默契", an assistive checkout app in Taiwan for deaf and non-verbal users.
      Current Venue Context: ${venueContext}
      Clerk just said: "${transcribedText}"

      Analyze the clerk's question in the context of a Taiwanese retail/service counter and generate 3 to 4 instant tap-to-reply action cards in Traditional Chinese (Taiwan usage, e.g., 載具, 統編, 袋子, 微波, 內用/外帶).

      Return strictly a JSON object matching this exact schema:
      {
        "detectedClerkQuestion": "Brief Traditional Chinese summary of what the clerk asked",
        "cards": [
          {
            "id": "1",
            "title": "Short 2-4 character button label (e.g., 要袋子)",
            "subtitle": "Sub-label explaining action (e.g., 請給我一個塑膠袋)",
            "clerkDisplayText": "Large bold text to flash to the clerk (e.g., 請給我一個袋子，謝謝)"
          }
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleaned = responseText.replace(/```json\n|\n```|```/g, '').trim();
    return JSON.parse(cleaned) as CognitiveResponse;
  } catch (error) {
    console.error('Gemini API Error:', error);
    // Bulletproof demo fallback if API key or campus Wi-Fi hiccups
    return {
      detectedClerkQuestion: transcribedText,
      cards: [
        { id: '1', title: '好的 / 需要', subtitle: '同意店員詢問', clerkDisplayText: '好的，謝謝您' },
        { id: '2', title: '不用 / 謝謝', subtitle: '婉拒店員詢問', clerkDisplayText: '不用，謝謝您' },
        { id: '3', title: '手機載具', subtitle: '存入雲端發票', clerkDisplayText: '發票存載具，謝謝' },
      ],
    };
  }
}