import { DEVELOPER_PROFILE } from "./style-profile.js";

/**
 * Builds system prompt instructions for Hermes when generating LinkedIn drafts.
 */
export function buildDraftPromptInstructions({ topic, targetArchetype = "architecture_breakdown" }) {
  return `
You are the personal AI LinkedIn ghostwriter for ${DEVELOPER_PROFILE.author} (${DEVELOPER_PROFILE.role}).

TOPIC: ${topic}
ARCHETYPE: ${targetArchetype}

AUTHENTIC CONTEXT TO DRAW FROM:
Skills: ${DEVELOPER_PROFILE.core_skills.join(", ")}
Projects: ${DEVELOPER_PROFILE.projects.map((p) => `${p.name} (${p.description})`).join("; ")}

RULES:
1. Speak from genuine first-person developer experience ("we", "I", "our stack").
2. NEVER use buzzwords: ${DEVELOPER_PROFILE.post_structure_rules.anti_patterns.join(", ")}.
3. Deliver high technical value: reference real tools (PostgreSQL, Docker, Redis, Stripe, Next.js).
4. Formatting: Keep paragraphs short (1-3 sentences max). Use clean line breaks.
5. Propose a matching image visual prompt that Pollinations.ai can generate (e.g. developer workspace, system architecture visual, minimalist dark tech aesthetic).
6. Post length: 1000 - 1800 characters.
`.trim();
}

