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

  // 1. Engineering / Tech Archetypes
  private readonly techArchetypes: CreatorArchetype[] = [
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

  // 2. UI/UX & Design Archetypes
  private readonly designArchetypes: CreatorArchetype[] = [
    {
      name: "DESIGN_SYSTEM_TEARDOWN",
      generate: (skill, user) => ({
        text:
          `Why most ${skill} setups look stunning in Figma but fall apart in production:\n\n` +
          `The failure is rarely visual — it's systemic. Designers build for static screen layouts; engineers build for dynamic states, variable content lengths, and localization.\n\n` +
          `3 rules we use to bridge the gap between design tokens and implementation:\n\n` +
          `1. Tokenize Semantics, Not Just Hex Values: Never name a color "$blue-500". Name it "$color-surface-action" so dark mode and theme refactors don't require rewriting 80 components.\n\n` +
          `2. Stress-test With Real Content Early: Design every component with 3x longer text and empty states before marking it ready for sprint handoff.\n\n` +
          `3. Accessibility as a Constraint, Not a Checklist: 4.5:1 contrast ratios and keyboard navigation focus states make interfaces clearer for everyone, not just screen readers.\n\n` +
          `${user.bioContext ? `Context: Learned while designing ${user.bioContext}.\n\n` : ""}` +
          `What's your biggest pain point when scaling design systems?`,
        imagePrompt: `Clean modern UI/UX design workspace showing design system token components and elegant wireframes on sleek digital tablet, minimalist aesthetic, warm lighting, 8k`,
      }),
    },
    {
      name: "CONTRARIAN_UX_LESSON",
      generate: (skill, user) => ({
        text:
          `An unpopular design opinion: Dribbble aesthetics are actively hurting product conversion.\n\n` +
          `We love low-contrast grey typography, floating 3D glassmorphism, and hidden menus until we look at real user session recordings.\n\n` +
          `When a user is trying to complete a checkout or configure a dashboard at 9 AM on a commute:\n\n` +
          `• Clarity crushes cleverness every time.\n` +
          `• A prominent, unmistakable button with clear copy beats subtle micro-animations.\n` +
          `• Predictable navigation reduces cognitive friction far more than bespoke UI patterns.\n\n` +
          `The most effective interface is often the one the user forgets they are interacting with.\n\n` +
          `Do you prioritize visual novelty or frictionless utility in ${skill}?`,
        imagePrompt: `Sleek high-contrast modern UI wireframe comparison showing clean UX flow against cluttered layout, dark mode aesthetic, crisp typography focus, photorealistic`,
      }),
    },
    {
      name: "USER_RESEARCH_DISCOVERY",
      generate: (skill, user) => ({
        text:
          `What 25 usability testing sessions taught us about ${skill}:\n\n` +
          `We were convinced users dropped off during onboarding because the step count was too long. The data proved us completely wrong.\n\n` +
          `The root issue was ambiguity in step 2. Users weren't fatigued — they were anxious about committing without knowing if they could edit later.\n\n` +
          `What changed after 3 small tweaks:\n\n` +
          `1. Added a persistent progress indicator and reassurance copy ("You can change this anytime in settings").\n` +
          `2. Replaced dense explanatory paragraphs with progressive disclosure tooltips.\n` +
          `3. Reduced form inputs per screen from 5 to 2.\n\n` +
          `Completion rate jumped +38% in 14 days.\n\n` +
          `Never assume why users abandon flows — watch them try to use it without speaking.`,
        imagePrompt: `Modern user experience research laboratory visual with usability heatmaps, journey maps, and interface telemetry on ultra-clean curved displays, cinematic dark theme, 8k`,
      }),
    },
  ];

  // 3. Product Management, Research & Growth Archetypes
  private readonly productArchetypes: CreatorArchetype[] = [
    {
      name: "FEATURE_ADOPTION_TEARDOWN",
      generate: (skill, user) => ({
        text:
          `The painful truth about product development in ${skill}:\n\n` +
          `Industry benchmark data shows that nearly 60% of software features built by agile teams are rarely or never used.\n\n` +
          `How we stopped building features nobody asked for:\n\n` +
          `1. The "Pain vs Frequency" Matrix: If a problem isn't experienced weekly or doesn't cost significant time/money, it doesn't get into the current quarter.\n\n` +
          `2. Sell It Before Building It: Test demand with clickable prototypes and fake door experiments before committing 2 engineering sprints.\n\n` +
          `3. Sunsetting Velocity: If a feature doesn't hit adoption thresholds within 90 days of release, evaluate deprecation instead of perpetual maintenance.\n\n` +
          `${user.bioContext ? `Context: Built while leading ${user.bioContext}.\n\n` : ""}` +
          `How does your team decide which backlog items actually make the roadmap?`,
        imagePrompt: `Strategic product roadmap visualization on modern digital canvas with glowing metrics charts, clean data indicators, minimalist executive workspace, photorealistic`,
      }),
    },
    {
      name: "CONTRARIAN_PRODUCT_LESSON",
      generate: (skill, user) => ({
        text:
          `A hard-earned lesson in ${skill}: Velocity is not the same as impact.\n\n` +
          `Shipping 15 Jira tickets a week feels productive, but if none of those tickets move retention, activation, or revenue — you're running fast in the wrong direction.\n\n` +
          `3 operational rules we now enforce:\n\n` +
          `• Define the success metric BEFORE writing user stories: If you can't measure whether the release worked, you don't understand the problem yet.\n` +
          `• Protect engineering focus ruthlessly: Say "no" to 8 good ideas so the 2 exceptional ones get the polish they deserve.\n` +
          `• Talk to churned customers: Current power users will tell you what they like; churned users will tell you what's actually broken.\n\n` +
          `What is your most important heuristic when evaluating product priorities?`,
        imagePrompt: `Modern executive product desk with dual analytics dashboards displaying cohort retention curves and KPI trends, warm ambient lighting, crisp resolution, 8k`,
      }),
    },
  ];

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService
  ) {}

  private getArchetypesForUser(user: any): CreatorArchetype[] {
    const roles = (user.positions || []).join(" ").toLowerCase();
    const skills = (user.skills || []).join(" ").toLowerCase();
    const combined = `${roles} ${skills} ${user.role || ""}`.toLowerCase();

    if (/design|ux|ui|figma|visual|creative/i.test(combined)) {
      return this.designArchetypes;
    }

    if (/product|marketing|founder|growth|analyst|business|research/i.test(combined)) {
      return this.productArchetypes;
    }

    return this.techArchetypes;
  }

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
    const deepseekKey = process.env.DEEPSEEK_API_KEY || this.config.get<string>("deepseek.apiKey");
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (deepseekKey) {
      try {
        return await this.generateWithDeepSeek(targetTopic, user, deepseekKey);
      } catch (err: any) {
        this.logger.warn(`DeepSeek generation failed: ${err.message}; falling back`);
      }
    }

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

    // Persona-Adaptive Archetype Synthesizer (rotates daily)
    const selectedArchetypes = this.getArchetypesForUser(user);
    const dayIndex = new Date().getDate() % selectedArchetypes.length;
    const archetype = selectedArchetypes[dayIndex];
    const generated = archetype.generate(targetTopic, user);

    const tags = [
      `#${targetTopic.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`,
      user.positions?.some((p: string) => /design|ux|ui/i.test(p))
        ? "#productdesign"
        : user.positions?.some((p: string) => /product|marketing|founder|business|research/i.test(p))
        ? "#productmanagement"
        : "#softwareengineering",
      "#leadership",
      "#innovation",
    ];

    return {
      text: generated.text,
      imagePrompt: generated.imagePrompt,
      topic: targetTopic,
      tags,
    };
  }

  private async generateWithDeepSeek(topic: string, user: any, apiKey: string) {
    const prompt = this.buildCreatorPrompt(topic, user);
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are an elite LinkedIn creator and subject matter practitioner. Write compelling, authentic, high-engagement insights. Return strictly valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    return this.parseLlmOutput(raw, topic);
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
    const positions =
      user.positions && user.positions.length > 0 ? user.positions.join(", ") : user.role || "Professional";
    const skills = user.skills && user.skills.length > 0 ? user.skills.join(", ") : "Technology & Strategy";

    const isDesign = /design|ux|ui|figma/i.test(positions);
    const isProductOrBiz = /product|marketing|founder|growth|research|analyst/i.test(positions);

    const personaContext = isDesign
      ? "an influential product design and UX leader known for sharp teardowns of usability, design systems, and user behavior"
      : isProductOrBiz
      ? "a seasoned product manager, growth strategist, and startup operator known for data-backed lessons and practical frameworks"
      : "an elite software architect and engineering practitioner (in the style of Alex Xu / ByteByteGo)";

    return `
You are an expert LinkedIn ghostwriter for ${personaContext}.
Author: ${user.name}
Role/Position: ${positions}
Core Skills: ${skills}
Background context: ${user.bioContext || "Modern industry workflows and real user impact"}

Write a top-performing, insightful LinkedIn post centered around: "${topic}".

STRICT FORMATTING RULES:
1. Hook: Start with a punchy, counter-intuitive observation or unexpected hard-earned lesson.
2. Value: Give 3 concrete, specific heuristics, principles, or real-world takeaways.
3. Formatting: Short paragraphs (1-2 sentences). Generous whitespace. No walls of text.
4. Tone: Senior, humble, pragmatic, authentic. ZERO corporate buzzwords (no "delve", "game-changer", "unleash", "tapestry").
5. Engagement: End with a thoughtful question for discussion in the comments.

Respond ONLY with valid JSON in this structure:
{
  "text": "Full post text",
  "imagePrompt": "A highly specific, photorealistic visual scene description representing the core technical, design, or business subject of this post (in the style of high-end editorial photography for Wired, MIT Tech Review, or Stripe Press). Describe a concrete physical subject, environment, lighting, depth of field, and textures. Do NOT request text, letters, or logos.",
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
        tags: parsed.tags || ["#linkedin", "#professionalgrowth"],
      };
    } catch {
      return {
        text: raw,
        imagePrompt: `Clean modern editorial tech visual representing ${defaultTopic}`,
        topic: defaultTopic,
        tags: ["#linkedin", "#insights"],
      };
    }
  }
}
