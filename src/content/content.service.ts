import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService
  ) {}

  /**
   * Generates post commentary and a matching visual prompt from a user topic.
   */
  async generatePost(
    topic: string,
    telegramUserId: string
  ): Promise<{ text: string; imagePrompt: string; topic: string; tags: string[] }> {
    const user = (await this.usersService.getUser(telegramUserId)) || {
      name: "Software Engineer",
      role: "Full-Stack Engineer",
    };

    const cleanTopic = topic.replace(/^(write a post about|create a draft for|post about|draft:?)\s*/i, "").trim();

    // Check for configured LLM API keys
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      try {
        return await this.generateWithGemini(cleanTopic, user, geminiKey);
      } catch (err: any) {
        this.logger.warn(`Gemini generation failed: ${err.message}; falling back`);
      }
    }

    if (groqKey) {
      try {
        return await this.generateWithGroq(cleanTopic, user, groqKey);
      } catch (err: any) {
        this.logger.warn(`Groq generation failed: ${err.message}; falling back`);
      }
    }

    if (openaiKey) {
      try {
        return await this.generateWithOpenAI(cleanTopic, user, openaiKey);
      } catch (err: any) {
        this.logger.warn(`OpenAI generation failed: ${err.message}; falling back`);
      }
    }

    // High-quality deterministic technical post template
    return this.generateTemplatePost(cleanTopic, user);
  }

  private generateTemplatePost(topic: string, user: any) {
    const text =
      `What I've learned working with ${topic} in production:\n\n` +
      `When scaling systems under real traffic, architectural simplicity usually beats clever abstractions. ` +
      `Here are 3 concrete lessons from our engineering stack:\n\n` +
      `1. Measure boundaries first: Before optimizing internal algorithms, instrument database connection latency, cache hit ratios, and network serialization overhead.\n\n` +
      `2. Design for failure isolation: Decouple read-heavy paths from state-mutating writes so spikes in user traffic don't cascade into transactional outages.\n\n` +
      `3. Invalidation discipline: Caching is easy; deciding when and how keys expire without causing thundering herds is where the real design work lives.\n\n` +
      `Engineers: what's the hardest production trade-off you've encountered with ${topic}? Let's swap notes in the comments.`;

    const imagePrompt = `Modern software architecture diagram and high-end developer workspace for ${topic}, clean glowing UI, dual monitors, subtle code elements, cinematic ambient lighting, photorealistic, 8k`;

    const tags = [
      `#${topic.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`,
      "#softwareengineering",
      "#systemdesign",
      "#backend",
      "#techleadership",
    ];

    return { text, imagePrompt, topic, tags };
  }

  private async generateWithGemini(topic: string, user: any, apiKey: string) {
    const prompt = this.buildPrompt(topic, user);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return this.parseLlmOutput(raw, topic);
  }

  private async generateWithGroq(topic: string, user: any, apiKey: string) {
    const prompt = this.buildPrompt(topic, user);
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    return this.parseLlmOutput(raw, topic);
  }

  private async generateWithOpenAI(topic: string, user: any, apiKey: string) {
    const prompt = this.buildPrompt(topic, user);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    return this.parseLlmOutput(raw, topic);
  }

  private buildPrompt(topic: string, user: any): string {
    return `
You are the personal AI LinkedIn ghostwriter for ${user.name} (${user.role}).
Write an authentic, insightful LinkedIn post about: "${topic}".

Format your response in JSON:
{
  "text": "The complete LinkedIn post text (1200-1800 characters, short punchy paragraphs, 3 bullet lessons, authentic technical voice, no cringe buzzwords)",
  "imagePrompt": "A descriptive prompt for an AI image generator representing this technical topic (clean developer workspace or architecture diagram, photorealistic, 8k)",
  "tags": ["#tag1", "#tag2", "#tag3"]
}
`.trim();
  }

  private parseLlmOutput(raw: string, defaultTopic: string) {
    try {
      const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return {
        text: parsed.text,
        imagePrompt: parsed.imagePrompt,
        topic: defaultTopic,
        tags: parsed.tags || ["#softwareengineering", "#tech"],
      };
    } catch {
      return {
        text: raw,
        imagePrompt: `Modern software engineering aesthetic for ${defaultTopic}, clean workspace, photorealistic`,
        topic: defaultTopic,
        tags: ["#softwareengineering", "#tech"],
      };
    }
  }
}

