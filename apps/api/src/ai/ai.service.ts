import { Injectable, BadRequestException } from "@nestjs/common";

interface PlaceSuggestion {
  name: string;
  country: string;
  lat: number;
  lng: number;
  confidence: number;
  description: string;
}

@Injectable()
export class AiService {
  async identifyPlace(imageBase64: string): Promise<PlaceSuggestion | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException(
        "AI camera requires OPENAI_API_KEY environment variable. Set it in .env file.",
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a geography expert. Analyze the photo and identify the location.
Return ONLY valid JSON (no markdown):
{
  "name": "place name",
  "country": "country name",
  "lat": number,
  "lng": number,
  "confidence": 0.0-1.0,
  "description": "brief description of the place"
}
If you cannot identify the place, return null.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "What place is shown in this photo?" },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new BadRequestException("AI service error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content || content === "null") return null;

    try {
      return JSON.parse(content) as PlaceSuggestion;
    } catch {
      return null;
    }
  }
}
