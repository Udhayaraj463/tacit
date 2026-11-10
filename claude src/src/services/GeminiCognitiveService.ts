import * as Haptics from 'expo-haptics';

export interface ActionOption {
  id: string;
  labelUser: string;      // 100% translated into user's preferred language
  labelClerk: string;     // Translated response back into the clerk's language (for 180° view)
  payloadType: 'text' | 'barcode' | 'confirmation';
}

export interface CognitiveResult {
  detectedClerkLanguage: string;
  heardMeaningInUserLang: string; // The staff's words translated into user's language
  questionUser: string;           // Actionable prompt for the user
  detectedAmount?: string;
  options: ActionOption[];
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export async function processSpeechWithGemini(
  rawTranscript: string,
  storeContext: string = 'convenience store',
  clerkSpokenLanguage: string = 'Tamil',
  userPreferredLanguage: string = 'English'
): Promise<CognitiveResult | null> {
  if (!rawTranscript || !rawTranscript.trim()) return null;

  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {}

  const systemInstruction = `
You are the real-time AAC Cognitive Engine for "Tacit (默契)".
The app helps a deaf or speech-impaired user communicate with a counter clerk.

Context:
- Staff Spoken Language: "${clerkSpokenLanguage}"
- User Preferred Language: "${userPreferredLanguage}"
- Store Context: "${storeContext}"

CRITICAL RULES:
1. Translate the staff's exact meaning into "${userPreferredLanguage}" ("heardMeaningInUserLang"). 
   - NEVER echo raw foreign words (e.g., if staff says "Nandri" in Tamil or "Arigato" in Japanese, translate directly to "Thank you" in ${userPreferredLanguage}).
2. Formulate "questionUser" in "${userPreferredLanguage}" summarizing what happened or what is being asked.
3. DYNAMICALLY GENERATE 3 to 4 fast response Action Cards that directly reply to what was just heard:
   - If staff says "Thank you" / "Have a nice day" -> Options must be polite departures (e.g., "You're welcome!", "Have a great day!", "Thank you, goodbye!").
   - If staff asks for bags/receipts -> Options must directly answer that question (e.g., "No bag needed", "Yes, small bag please", "E-carrier / No paper receipt").
   - If staff mentions price/payment -> Options must be payment methods (e.g., "Credit Card", "Apple Pay", "Cash").
4. "labelUser": The reply written in "${userPreferredLanguage}".
5. "labelClerk": The reply translated accurately into the clerk's language (${clerkSpokenLanguage}), which will be flipped 180° for the clerk to read across the counter.

Output MUST be strictly JSON matching:
{
  "detectedClerkLanguage": "${clerkSpokenLanguage}",
  "heardMeaningInUserLang": string,
  "questionUser": string,
  "detectedAmount": string or null,
  "options": [
    {
      "id": string,
      "labelUser": string,
      "labelClerk": string,
      "payloadType": "text" | "barcode" | "confirmation"
    }
  ]
}
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `Staff speech heard: "${rawTranscript}"` }]
          }
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    return JSON.parse(candidateText) as CognitiveResult;
  } catch (error) {
    console.error('Gemini Cognitive Translation error:', error);
    return null;
  }
}