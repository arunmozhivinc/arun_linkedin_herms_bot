import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";

interface CreatorArchetype {
  name: string;
  generate: (skill: string, user: any) => { text: string; imagePrompt: string };
}

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  // Proven high-engagement developer creator archetypes (inspired by top tech creators)
  private readonly archetypes: CreatorArchetype[] = [
    {
      name: "ARCHITECTURAL_TEARDOWN",
      generate: (skill, user) => ({
        text:
          `Why default architectural setups in ${skill} break under real production load — and how we redesigned it:\n\n` +
          `When we first deployed high-throughput services with ${skill}, our bottleneck wasn't CPU or memory — ` +
          `it was connection pool exhaustion and unindexed read amplification under concurrent spikes.\n\n` +
          `Here is the architectural pattern that stabilized our p99 latency:\n\n` +
          `1. Boundary Timeouts: Never rely on default client timeouts. Set strict socket and read deadlines upstream before requests hit the database.\n\n` +
          `2. Composable Cache Invalidation: Instead of long generic TTLs, tie invalidation directly to write pathways so stale reads never corrupt customer state.\n\n` +
          `3. Circuit Breaking: Wrap third-party and downstream RPC calls with fast-failing fallback paths to isolate failures.\n\n` +
          `${user.bioContext ? `Context: Built while working on ${user.bioContext}.\n\n` : ""}` +
          `What's your golden rule when optimizing ${skill} architectures?`,
        imagePrompt: `Clean modern software architecture diagram illustrating high-throughput ${skill} system with glowing data flows, minimalist dark aesthetic, crisp vector infographic, 8k resolution`,
      }),
    },
    {
      name: "CONTRARIAN_LESSON",
      generate: (skill, user) => ({
        text:
          `An unpopular opinion on ${skill} after running it in production for years:\n\n` +
          `90% of architectural complexity isn't solving user problems — it's compensating for premature optimization and over-engineered abstractions.\n\n` +
          `A few pragmatic rules we now follow religiously:\n\n` +
          `• Start monolithic and modular: Don't break into microservices until team boundaries and deployment velocity demand it.\n` +
          `• Boring technology wins: A well-tuned ${skill} instance with proper indexes will outlast 3 layers of caching you haven't properly instrumented.\n` +
          `• Optimize observability first: If you can't trace a request's end-to-end latency in under 30 seconds, your abstractions are hiding failures, not preventing them.\n\n` +
          `Pragmatism beats hype every single time.\n\n` +
          `Do you agree, or do you prefer adopting the newest patterns early? Let's discuss below.`,
        imagePrompt: `Minimalist high-end developer desk setup with dark theme IDE displaying clean ${skill} code, dual monitors, subtle warm ambient backlighting, cinematic photography, photorealistic 8k`,
      }),
    },
    {
      name: "PRODUCTION_POST_MORTEM",
      generate: (skill, user) => ({
        text:
          `Post-mortem: The subtle concurrency bug in our ${skill} service that took 3 hours to track down.\n\n` +
          `Everything passed in staging. Tests were green. But 15 minutes after deployment under production traffic, ` +
          `memory usage began a slow, relentless climb until pods restarted on OOM.\n\n` +
          `The root cause wasn't a leak in our logic. It was an unclosed event listener inside a connection retry loop that silently retained buffer references.\n\n` +
          `Key takeaways for any team building with ${skill}:\n\n` +
          `1. Audit teardown handlers: For every subscription or connection acquired, verify explicit cleanup on error pathways.\n` +
          `2. Heap snapshots under synthetic load: Run automated soak tests before approving high-scale infrastructure migrations.\n` +
          `3. Graceful degradation: Ensure failing instances shed load without deadlocking active workers.\n\n` +
          `What is the most memorable production bug you've debugged in ${skill}?`,
        imagePrompt: `Dramatic tech workstation visual with telemetry dashboards and terminal logs diagnosing a ${skill} issue, warm amber and blue contrast lighting, ultra-sharp detail, photorealistic`,
      }),
    },
    {
      name: "TOOLING_COMPARISON",
      generate: (skill, user) => ({
        text:
          `Choosing the right stack: What we evaluated before committing to ${skill} for our core backend:\n\n` +
          `Too many tech evaluations focus on synthetic benchmarks instead of day-two operational reality.\n\n` +
          `Here is how we weighed the trade-offs:\n\n` +
          `• Developer Velocity vs Runtime Speed: High developer ergonomics and strong typing saved us hundreds of engineering hours before compute costs even mattered.\n` +
          `• Ecosystem Maturity: The availability of battle-tested drivers, migration tooling, and community support in ${skill} significantly outweighed newer experimental alternatives.\n` +
          `• Debuggability: Being able to inspect memory and trace distributed requests easily in production made on-call rotations predictable.\n\n` +
          `The best tool isn't the fastest on paper — it's the one your team can operate reliably at 3 AM.\n\n` +
          `What factor matters most to your team when picking backend tools?`,
        imagePrompt: `Side-by-side architectural system comparison diagram for ${skill} on a dark grid canvas, modern clean tech infographic, glowing neon accents, 8k photorealistic`,
      }),
    },
  ];

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService
  ) {}

  /**
   * Generates a polished, viral LinkedIn post based on user skills, bio context, and top creator formats.
   */
  async generatePost(
    topicOrSkill: string,
    telegramUserId: string
  ): Promise<{ text: string; imagePrompt: string; topic: string; tags: string[] }> {
    const user = (await this.usersService.getUser(telegramUserId)) || {
      name: "Software Engineer",
      role: "Software Professional",
      skills: ["TypeScript", "Node.js", "System Design"],
    };

    let targetTopic = topicOrSkill
      ? topicOrSkill.replace(/^(write a post about|create a draft for|post about|draft:?)\s*/i, "").trim()
      : "";

    if (!targetTopic) {
      // Pick randomly from user's chosen skills
      const skills = user.skills && user.skills.length > 0 ? user.skills : ["Node.js / TypeScript", "System Design"];
      targetTopic = skills[Math.floor(Math.random() * skills.length)];
    }

    // Check for configured LLM API keys
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      try {
        return await this.generateWithGemini(targetTopic, user, geminiKey);
      } catch (err: any) {
        this.logger.warn(`Gemini generation failed: ${err.message}; falling back`);
      }
    }

    if (groqKey) {
      try {
        return await this.generateWithGroq(targetTopic, user, groqKey);
      } catch (err: any) {
        this.logger.warn(`Groq generation failed: ${err.message}; falling back`);
      }
    }

    if (openaiKey) {
      try {
        return await this.generateWithOpenAI(targetTopic, user, openaiKey);
      } catch (err: any) {
        this.logger.warn(`OpenAI generation failed: ${err.message}; falling back`);
      }
    }

    // Creator Archetype Synthesizer (rotates daily)
    const dayIndex = new Date().getDate() % this.archetypes.length;
    const archetype = this.archetypes[dayIndex];
    const generated = archetype.generate(targetTopic, user);

    const tags = [
      `#${targetTopic.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`,
      "#softwareengineering",
      "#systemdesign",
      "#devcommunity",
      "#techleadership",
    ];

    return {
      text: generated.text,
      imagePrompt: generated.imagePrompt,
      topic: targetTopic,
      tags,
    };
  }

  private async generateWithGemini(topic: string, user: any, apiKey: string) {
    const prompt = this.buildCreatorPrompt(topic, user);
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
    const prompt = this.buildCreatorPrompt(topic, user);
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
    const prompt = this.buildCreatorPrompt(topic, user);
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

  private buildCreatorPrompt(topic: string, user: any): string {
    const positions = user.positions && user.positions.length > 0 ? user.positions.join(", ") : user.role || "Senior Software Engineer";
    const skills = user.skills && user.skills.length > 0 ? user.skills.join(", ") : "Backend, Cloud, Systems";

    return `
You are an expert LinkedIn ghostwriter for elite tech creators (like Alex Xu / ByteByteGo / Gergely Orosz).
Author: ${user.name}
Role/Position: ${positions}
Core Skills: ${skills}
Background context: ${user.bioContext || "High-scale production systems"}

Write a top-performing, insightful LinkedIn post centered around: "${topic}".

STRICT FORMATTING RULES:
1. Hook: Start with a punchy, counter-intuitive technical observation or unexpected production lesson.
2. Value: Give 3 concrete, specific engineering principles or code/architecture heuristics.
3. Formatting: Short paragraphs (1-2 sentences). Generous whitespace. No walls of text.
4. Tone: Senior, humble, pragmatic, deeply technical. ZERO corporate buzzwords (no "delve", "game-changer", "unleash", "tapestry").
5. Engagement: End with an open-ended engineering question for comments.

Respond ONLY with valid JSON in this structure:
{
  "text": "Full post text",
  "imagePrompt": "A detailed descriptive prompt for an AI image generator representing this technical topic (modern developer workstation or clean architecture diagram, photorealistic, 8k)",
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
        tags: parsed.tags || ["#softwareengineering", "#systemdesign"],
      };
    } catch {
      return {
        text: raw,
        imagePrompt: `Clean software engineering architecture visual for ${defaultTopic}, photorealistic 8k`,
        topic: defaultTopic,
        tags: ["#softwareengineering", "#tech"],
      };
    }
  }
}
