const dns = require("node:dns");
try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch {}
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");

async function syncAll() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "linkedin_hermes" });
  
  // 1. Sync Users
  if (fs.existsSync("data/users.json")) {
    const users = JSON.parse(fs.readFileSync("data/users.json", "utf8"));
    const usersCol = mongoose.connection.db.collection("users");
    for (const u of users) {
      await usersCol.updateOne({ telegramUserId: u.telegramUserId }, { $set: u }, { upsert: true });
      console.log("✅ Synced User:", u.name, u.telegramUserId);
    }
  }

  // 2. Sync Drafts
  if (fs.existsSync("data/drafts.json")) {
    const raw = JSON.parse(fs.readFileSync("data/drafts.json", "utf8"));
    const drafts = raw.drafts || [];
    const draftsCol = mongoose.connection.db.collection("drafts");
    for (const d of drafts) {
      const draftId = d.draftId || d.id;
      const payload = {
        ...d,
        draftId,
        userId: d.userId || "1623358470",
      };
      await draftsCol.updateOne({ draftId }, { $set: payload }, { upsert: true });
      console.log("✅ Synced Draft:", draftId, "Status:", d.status);
    }
  }

  console.log("Sync complete!");
  process.exit(0);
}

syncAll().catch((e) => {
  console.error("Sync error:", e);
  process.exit(1);
});
