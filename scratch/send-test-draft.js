const dns = require("node:dns");
try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch {}
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");

async function createAndSendTest() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "linkedin_hermes" });
  const draftsCol = mongoose.connection.db.collection("drafts");

  const draftId = "GL-20260910-009";
  const newDraft = {
    draftId,
    userId: "1623358470",
    postType: "SHORT_POST",
    status: "PENDING_APPROVAL",
    text: "Testing the live approval workflow for LinkedIn AutoPilot:\n\n1. Autonomous topic research via Hermes\n2. Real-time visual generation via Pollinations\n3. 1-Tap Mobile Review in Telegram\n\nTap Approve to publish or Skip to discard!",
    media: {
      type: "image",
      url: "https://image.pollinations.ai/prompt/Modern%20software%20engineering%20workspace%20with%20clean%20architecture%20diagrams%2C%20warm%20lighting?width=1200&height=627&model=flux&nologo=true",
      prompt: "Modern software engineering workspace with clean architecture diagrams, warm lighting",
    },
    metadata: { topic: "Autonomous Agent Architecture" },
    contentHash: "test-hash-009",
    createdAt: new Date(),
    updatedAt: new Date(),
    approvedAt: null,
    publishedAt: null,
    postId: null,
  };

  await draftsCol.updateOne({ draftId }, { $set: newDraft }, { upsert: true });

  // Update local file too
  const raw = JSON.parse(fs.readFileSync("data/drafts.json", "utf8"));
  const filtered = (raw.drafts || []).filter((d) => (d.draftId || d.id) !== draftId);
  filtered.push({ ...newDraft, id: draftId });
  fs.writeFileSync("data/drafts.json", JSON.stringify({ drafts: filtered }, null, 2), "utf8");

  // Send to Telegram
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const baseUrl = process.env.BASE_URL || "https://demeaning-edging-smelting.ngrok-free.dev";

  const payload = {
    chat_id: "1623358470",
    photo: newDraft.media.url,
    caption:
      "📝 *Fresh Pending Draft for Review*\n\n" +
      `*Draft ID:* \`${draftId}\`\n` +
      `*Topic:* ${newDraft.metadata.topic}\n\n` +
      `${newDraft.text}\n\n` +
      "*Tap Approve or Skip below:*",
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `approve_${draftId}` },
          { text: "❌ Skip", callback_data: `reject_${draftId}` },
        ],
        [
          { text: "📱 Full Web Preview", url: `${baseUrl}/drafts/${draftId}` },
        ],
      ],
    },
  };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log("✅ Sent fresh test draft 009 to Telegram:", data.ok);
  process.exit(0);
}

createAndSendTest().catch((e) => {
  console.error(e);
  process.exit(1);
});

