/**
 * Content Intelligence & Post Pattern Research Framework.
 * Helps Hermes identify winning post structures from top engineering creators
 * and translate them into authentic posts reflecting Arun's skills.
 */

export const POST_ARCHETYPES = [
  {
    type: "production_incident",
    description: "A production bug, outage, or performance bottleneck and how it was diagnosed and resolved.",
    example_hook: "A single Redis query spiked our latency from 45ms to 3.2s last month. Here is what we found:",
    flow: ["The symptom & metric", "The flawed initial assumption", "The root cause in the code/config", "The fix & monitoring added", "Rule of thumb"],
  },
  {
    type: "architecture_breakdown",
    description: "Comparing two architectural choices or explaining a system design decision.",
    example_hook: "Most developers reach for BullMQ or Redis queues too early. When we built Gear Loop, we started with PostgreSQL SKIP LOCKED. Here's why:",
    flow: ["The problem statement", "Why the obvious choice had too much overhead", "How the simpler approach works", "When you will actually need to upgrade", "Discussion question"],
  },
  {
    type: "developer_opinion_deepdive",
    description: "A nuanced take on modern tech stack debates backed by hands-on experience.",
    example_hook: "Next.js Server Components solve data fetching, but they break the mental model of client caching unless you design this one layer upfront:",
    flow: ["The common frustration", "The architectural reality under the hood", "Practical pattern to structure it cleanly", "Takeaway"],
  },
  {
    type: "fullstack_leadership",
    description: "Lessons from shipping products end-to-end, balancing speed vs tech debt.",
    example_hook: "Shipping Stripe checkout looks easy in docs until you handle webhook retries and inventory locking concurrently.",
    flow: ["The naive implementation", "The edge case that breaks it in production", "Idempotency keys and state machines", "Actionable advice"],
  },
];

export function getResearchGuidelines() {
  return {
    archetypes: POST_ARCHETYPES,
    instructions: "Choose the archetype that best matches the topic. Synthesize the structure, but never copy wording or claim experience not present in DEVELOPER_PROFILE.",
  };
}

