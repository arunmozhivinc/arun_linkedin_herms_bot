import { createDraft } from "./src/approval/approval-service.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const text = `What I learned optimising Redis caching for high-read gear listings at GearLoop

GearLoop gear listing pages are read-heavy — browsers preload, recommendation widgets fire parallel calls, and a single listing view can trigger a dozen downstream queries before the page paints. When traffic spikes, that pattern hits the database first and the UI second. We decided to flip that.

A few things stood out after going through the Redis layers:

1. Not every read deserves the same cache.
Listings, availability windows, pricing, and images all have different refresh needs. We stopped treating the listing endpoint as one cache entry and split it into composable fragments — static-ish metadata gets a long TTL, availability gets a short one with explicit invalidation, and computed pricing stays out of cache unless the inputs are stable. Granularity matters more than TTL tuning alone.

2. Cache-aside is the default, but invalidate deliberately.
The easy win is cache-aside: read through Redis, fall back to the DB, write back on miss. The hard part people skip is invalidation. We wired cache invalidation into the write paths that actually change listing data — price updates, availability changes, image swaps — instead of relying on expiry to eventually correct things. If you don't invalidate on write, you'll spend your time debugging stale listings, not slow queries.

3. Key design determines how much you can invalidate cleanly.
A good key scheme makes targeted invalidation cheap. We moved from flat keys toward structured ones that encode the resource, the variant, and the version, so a single logical change can invalidate exactly what it should without blanket flushes.

4. Cache warming beats cold starts on the hot paths.
For the most-read listings, waiting for the first request to populate the cache meant the Cache-Miss penalty hit real users. We added targeted warm-up for high-traffic items after edits and during deploy, so the cache is already useful when traffic arrives.

5. Measure before and after, not just "it feels faster."
Latency percentiles, hit rates, and DB load are the numbers that matter here. We watched p95/p99 on the listing endpoints drop and DB query volume come down on the read paths.

What didn't work:
- One big cache for everything — invalidation became impossible.
- Long TTLs without invalidation — stale data that was hard to explain.
- Caching derived values whose inputs changed independently — subtle bugs that only showed up under real traffic.

The throughline: Redis is straightforward to add. Getting it right for a high-read listing surface is mostly about what you invalidate, when, and how you key it.

Happy to swap notes if you're working on similar read-heavy surfaces — what's been the biggest caching gotcha on your side?`;

const media = {
  type: "image",
  url: "file://" + path.resolve(__dirname, "data/images/img_arun_workstation_real.jpg"),
  path: path.resolve(__dirname, "data/images/img_arun_workstation_real.jpg"),
  prompt: "Real developer workstation photo — multi-monitor setup with Contra Shift Planner, code editor, ThinkPad, coffee mug, water bottle",
  altText: "Arun Vincily V — developer workstation",
};

const draft = createDraft({
  text,
  media,
  topic: "Redis / System Design / GearLoop",
  tags: ["#redis", "#systemdesign", "#caching", "#gearloop", "#backendengineering"],
});

console.log(JSON.stringify({ success: true, draft }, null, 2));
