import { createDraft } from "./src/approval/approval-service.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const text = `Our Redis caching strategy at GearLoop — what we actually built

After the first round of caching at GearLoop, we learned pretty quickly that adding Redis is the easy part. Deciding what to cache, how long, and when to throw it away — that's where the real design work lives.

Here's the strategy we settled on for the high-read gear listing surface:

Layer 1: Static metadata, long TTL.
Things like gear name, description, images, category — data that changes rarely and costs real DB attention to fetch. These get a generous TTL and only refresh when an edit actually happens. No point hitting PostgreSQL for a gear description on every page view.

Layer 2: Availability windows, short TTL + explicit invalidation.
This is the tricky one. Availability is dynamic, time-sensitive, and wrong data here means double-bookings or frustrated renters. We keep these entries short-lived AND invalidate them the moment a booking changes. Short TTL is the safety net; invalidation is the real mechanism.

Layer 3: Computed pricing — only cache when inputs are stable.
Pricing depends on dates, add-ons, taxes, fees, promo codes. If any of those inputs are volatile, caching the result creates more problems than it solves. We cache pricing only when we can prove the inputs are stable for the TTL window.

Layer 4: Cache warming for the hot items.
The most-viewed listings shouldn't pay the cold-start penalty on their first request after a deploy or an edit. We warm the cache for high-traffic items proactively, so the cache is useful before the traffic arrives.

The invalidation discipline is the part that took the most effort:
- Every write path that changes listing data explicitly invalidates the relevant cache entries.
- We don't rely on TTL expiry to eventually fix stale data.
- Keys are structured (resource + variant + version) so invalidation is targeted, not blunt.

A few things we deliberately did NOT do:
- One giant cache entry for the whole listing — impossible to invalidate cleanly.
- Long TTLs with no invalidation plan — stale data you can't explain.
- Caching derived values with volatile inputs — subtle bugs under real traffic.

The numbers we watch: p95/p99 on the listing endpoints, cache hit rate on the read paths, and DB query volume. Those tell us whether the cache is actually helping or just moving the problem around.

Redis is simple to add. Getting the strategy right — granularity, invalidation, key design, warming — that's the actual engineering work. Most of the value is in the decisions, not the library.

What's your approach to layered caching on read-heavy surfaces? Curious how others think about the TTL vs invalidation tradeoff.`;

const media = {
  type: "image",
  url: "https://image.pollinations.ai/prompt/Minimalist%20dark%20tech%20background%20with%20subtle%20horizontal%20grid%20lines%20fading%20into%20deep%20black%2C%20a%20single%20glowing%20red%20horizontal%20accent%20bar%20in%20the%20center%20evoking%20a%20Redis%20cache%20layer%2C%20soft%20ambient%20lighting%2C%20clean%20modern%20software%20engineering%20aesthetic%2C%20abstract%20and%20elegant%2C%20high%20resolution%2C%20no%20text%2C%20no%20logos%2C%20professional%20tech%20visual?width=1200&height=627&model=flux&nologo=true&seed=382910",
  path: null,
  prompt: "Minimalist dark tech background with subtle horizontal grid lines fading into deep black, a single glowing red horizontal accent bar in the center evoking a Redis cache layer, soft ambient lighting, clean modern software engineering aesthetic, abstract and elegant, high resolution, no text, no logos",
  altText: "Redis caching strategy — layered cache visual",
};

const draft = createDraft({
  text,
  media,
  topic: "Redis / System Design / GearLoop",
  tags: ["#redis", "#systemdesign", "#caching", "#gearloop", "#backendengineering"],
});

console.log(JSON.stringify({ success: true, draft }, null, 2));
