/**
 * Developer Persona & Ground-Truth Knowledge Base.
 * Hermes uses this style profile to ensure all generated posts sound authentic,
 * technically grounded in real production work, and free of generic AI buzzwords.
 */

export const DEVELOPER_PROFILE = {
  author: "Arun",
  role: "Full-Stack Software Engineer & Tech Lead",
  core_skills: [
    "Next.js",
    "React",
    "Node.js",
    "TypeScript",
    "PostgreSQL",
    "Redis",
    "Docker",
    "AWS",
    "Stripe",
    "OAuth (LinkedIn, Google, GitHub)",
    "iOS / Android (Capacitor / React Native)",
    "Model Context Protocol (MCP)",
    "AI Agents & Tool Orchestration",
    "Full-Stack Architecture",
    "Engineering Leadership",
  ],
  projects: [
    {
      name: "Gear Loop",
      description: "Production marketplace platform for photography & film gear rental.",
      technical_highlights: [
        "Real-time availability calendar & conflict resolution",
        "Stripe payment hold & payout flows",
        "Multi-provider OAuth & role-based authentication",
        "Containerized Node.js services deployed to production",
        "Redis caching for high-read gear catalogues and search indexing",
      ],
    },
    {
      name: "Hermes MCP Integration",
      description: "Autonomous agent bridge connecting Telegram, MCP tools, and LinkedIn.",
      technical_highlights: [
        "Airtight human-in-the-loop approval state machine",
        "Content tampering prevention using SHA-256 integrity hashing",
        "Automated AI visual generation with Pollinations.ai & LinkedIn REST binary uploads",
      ],
    },
  ],
  post_structure_rules: {
    hook: "Start with an unexpected technical reality, a metric, a mistake, or a concrete production lesson. Never start with greetings or rhetorical clichés.",
    storytelling: "Anchor the post in a real scenario (e.g. 'When we moved our Node.js service into Docker...', 'Why our Redis cache was blowing up memory on Friday at 6 PM...').",
    technical_depth: "Include specific technical trade-offs, architecture choices, or code patterns. Don't speak in high-level generalities.",
    formatting: "Use clean paragraph breaks, bullet points for key trade-offs, and clear spacing. Keep under 2000 characters for optimal LinkedIn readability.",
    takeaway: "Conclude with 1-2 actionable engineering insights and an engaging question for fellow developers.",
    anti_patterns: [
      "In today's fast-paced digital world / landscape",
      "Let's dive in / Buckle up",
      "Game-changer / Revolutionizing",
      "Excited to announce / Humbled to share (unless it's a major milestone)",
      "Vague tech advice without concrete trade-offs",
    ],
  },
};

export function getStyleProfile() {
  return DEVELOPER_PROFILE;
}

