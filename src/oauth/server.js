import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { saveToken, loadToken, isTokenValid } from "./token-store.js";
import {
  getAllDrafts,
  getDraftById,
} from "../approval/approval-store.js";
import {
  approveDraft,
  rejectDraft,
} from "../approval/approval-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.resolve(__dirname, "../../data/images");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/images", express.static(IMAGES_DIR));

const {
  LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET,
  LINKEDIN_REDIRECT_URI = "http://localhost:3000/auth/linkedin/callback",
} = process.env;

let oauthState = null;

// --------------------------------------------------
// Home Page Dashboard
// --------------------------------------------------
app.get("/", (req, res) => {
  const token = loadToken();
  const valid = isTokenValid();
  const drafts = getAllDrafts();
  const pending = drafts.filter((d) => d.status === "PENDING_APPROVAL").length;
  const approved = drafts.filter((d) => d.status === "APPROVED").length;
  const published = drafts.filter((d) => d.status === "PUBLISHED").length;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LinkedIn Hermes Control Center</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; }
        .container { max-width: 800px; margin: 0 auto; }
        .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #334155; }
        h1, h2 { margin-top: 0; }
        .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: bold; font-size: 0.875rem; }
        .badge-green { background: #065f46; color: #34d399; }
        .badge-red { background: #991b1b; color: #f87171; }
        .badge-yellow { background: #854d0e; color: #fde047; }
        .badge-blue { background: #1e40af; color: #93c5fd; }
        .btn { display: inline-block; background: #2563eb; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; font-weight: 500; border: none; cursor: pointer; }
        .btn:hover { background: #1d4ed8; }
        .btn-success { background: #059669; }
        .btn-success:hover { background: #047857; }
        .btn-danger { background: #dc2626; }
        .btn-danger:hover { background: #b91c1c; }
        .stats { display: flex; gap: 1rem; margin-top: 1rem; }
        .stat-box { flex: 1; background: #0f172a; padding: 1rem; border-radius: 8px; text-align: center; border: 1px solid #334155; }
        .stat-val { font-size: 1.75rem; font-weight: bold; }
        a { color: #60a5fa; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 LinkedIn Hermes Control Center</h1>
        
        <div class="card">
          <h2>LinkedIn Connection Status</h2>
          <p>
            Status: ${valid 
              ? '<span class="status-badge badge-green">✓ Connected & Active</span>' 
              : '<span class="status-badge badge-red">✗ Disconnected / Expired</span>'}
          </p>
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <a href="/auth/linkedin" class="btn">🔑 ${token ? "Re-Authenticate LinkedIn" : "Connect LinkedIn"}</a>
            <a href="/linkedin/profile" class="btn" style="background: #475569;">👤 Test Profile API</a>
          </div>
        </div>

        <div class="card">
          <h2>Drafts & Approval Pipeline</h2>
          <div class="stats">
            <div class="stat-box">
              <div class="stat-val" style="color: #fde047;">${pending}</div>
              <div>Pending Approval</div>
            </div>
            <div class="stat-box">
              <div class="stat-val" style="color: #34d399;">${approved}</div>
              <div>Approved</div>
            </div>
            <div class="stat-box">
              <div class="stat-val" style="color: #93c5fd;">${published}</div>
              <div>Published</div>
            </div>
          </div>
          <p style="margin-top: 1.5rem;">
            <a href="/drafts" class="btn btn-success">📋 View All Drafts</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// --------------------------------------------------
// LinkedIn OAuth
// --------------------------------------------------
app.get("/auth/linkedin", (req, res) => {
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
    return res.status(500).send("LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET not configured in .env");
  }

  oauthState = crypto.randomBytes(32).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: LINKEDIN_REDIRECT_URI,
    state: oauthState,
    scope: "openid profile email w_member_social",
  });

  const authorizationUrl = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  res.redirect(authorizationUrl);
});

// --------------------------------------------------
// OAuth Callback
// --------------------------------------------------
app.get("/auth/linkedin/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.status(400).json({ error, error_description });
  }

  if (!state || state !== oauthState) {
    return res.status(401).json({ error: "Invalid OAuth state" });
  }

  if (!code) {
    return res.status(400).json({ error: "No authorization code received" });
  }

  try {
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: LINKEDIN_REDIRECT_URI,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(tokenData);
      return res.status(400).json({ error: "LinkedIn token exchange failed", details: tokenData });
    }

    saveToken(tokenData);

    console.log("====================================");
    console.log("LinkedIn OAuth successful");
    console.log("Access token stored in ~/.linkedin-hermes-token.json");
    console.log("Expires in:", tokenData.expires_in, "seconds");
    console.log("Scopes:", tokenData.scope);
    console.log("====================================");

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OAuth callback failed", message: err.message });
  }
});

// --------------------------------------------------
// LinkedIn Profile Test Endpoint
// --------------------------------------------------
app.get("/linkedin/profile", async (req, res) => {
  const tokenData = loadToken();

  if (!tokenData?.access_token) {
    return res.status(401).json({
      error: "Not authenticated with LinkedIn",
      message: "Visit /auth/linkedin first",
    });
  }

  try {
    const response = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: "LinkedIn API request failed", details: data });
    }

    res.json({ success: true, linkedin_profile: data });
  } catch (err) {
    res.status(500).json({ error: "LinkedIn profile request failed", message: err.message });
  }
});

// --------------------------------------------------
// Drafts List & Preview Web Routes
// --------------------------------------------------
app.get("/drafts", (req, res) => {
  const drafts = getAllDrafts().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>All Drafts - LinkedIn Hermes</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; margin: 0; }
        .container { max-width: 900px; margin: 0 auto; }
        .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #334155; }
        .badge { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 4px; font-weight: bold; font-size: 0.8rem; }
        .PENDING_APPROVAL { background: #854d0e; color: #fde047; }
        .APPROVED { background: #065f46; color: #34d399; }
        .PUBLISHED { background: #1e40af; color: #93c5fd; }
        .REJECTED { background: #991b1b; color: #f87171; }
        .btn { display: inline-block; background: #2563eb; color: white; padding: 0.4rem 0.8rem; border-radius: 6px; text-decoration: none; font-size: 0.875rem; }
        a { color: #60a5fa; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <p><a href="/">← Back to Dashboard</a></p>
        <h1>LinkedIn Post Drafts</h1>
        ${drafts.length === 0 ? "<p>No drafts created yet. Ask Hermes to generate a draft!</p>" : ""}
        ${drafts.map((d) => `
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-weight: bold; font-size: 1.1rem;">${d.id}</span>
              <span class="badge ${d.status}">${d.status}</span>
            </div>
            <p style="color: #94a3b8; font-size: 0.85rem;">Created: ${new Date(d.createdAt).toLocaleString()} | Topic: ${d.metadata?.topic || "General"}</p>
            <p style="white-space: pre-wrap; max-height: 120px; overflow: hidden; text-overflow: ellipsis;">${d.text}</p>
            <div style="margin-top: 1rem;">
              <a href="/drafts/${d.id}" class="btn">View & Review Draft →</a>
            </div>
          </div>
        `).join("")}
      </div>
    </body>
    </html>
  `);
});

// Single Draft Preview & 1-Tap Mobile Review
app.get("/drafts/:id", (req, res) => {
  const draft = getDraftById(req.params.id);
  if (!draft) {
    return res.status(404).send("Draft not found.");
  }

  const imageUrl = draft.media?.url 
    ? draft.media.url 
    : (draft.media?.path ? `/images/${path.basename(draft.media.path)}` : null);

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Draft Preview: ${draft.id}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 1.5rem; margin: 0; }
        .container { max-width: 700px; margin: 0 auto; }
        .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #334155; }
        .badge { display: inline-block; padding: 0.35rem 0.75rem; border-radius: 9999px; font-weight: bold; font-size: 0.9rem; }
        .PENDING_APPROVAL { background: #854d0e; color: #fde047; }
        .APPROVED { background: #065f46; color: #34d399; }
        .PUBLISHED { background: #1e40af; color: #93c5fd; }
        .REJECTED { background: #991b1b; color: #f87171; }
        .post-text { background: #0f172a; padding: 1.25rem; border-radius: 8px; font-size: 1rem; line-height: 1.6; white-space: pre-wrap; border: 1px solid #334155; margin: 1rem 0; }
        .media-preview { width: 100%; border-radius: 8px; margin-top: 1rem; max-height: 400px; object-fit: cover; border: 1px solid #334155; }
        .btn { display: inline-block; padding: 0.8rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1rem; border: none; cursor: pointer; text-align: center; }
        .btn-approve { background: #059669; color: white; flex: 2; }
        .btn-approve:hover { background: #047857; }
        .btn-reject { background: #dc2626; color: white; flex: 1; }
        .btn-reject:hover { background: #b91c1c; }
        a { color: #60a5fa; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <p><a href="/drafts">← Back to All Drafts</a></p>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h2>${draft.id}</h2>
            <span class="badge ${draft.status}">${draft.status}</span>
          </div>
          <p style="color: #94a3b8; font-size: 0.9rem;">Topic: <strong>${draft.metadata?.topic || "General"}</strong></p>
          
          <div class="post-text">${draft.text}</div>

          ${imageUrl ? `
            <div>
              <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.25rem;">Attached Visual (Pollinations.ai):</p>
              <img src="${imageUrl}" alt="Visual Preview" class="media-preview" />
              ${draft.media?.prompt ? `<p style="font-size: 0.8rem; color: #64748b; margin-top: 0.3rem;">Prompt: ${draft.media.prompt}</p>` : ""}
            </div>
          ` : ""}

          <div style="margin-top: 1.5rem;">
            ${draft.status === "PENDING_APPROVAL" ? `
              <div style="display: flex; gap: 1rem;">
                <a href="/drafts/${draft.id}/approve" class="btn btn-approve">✅ Approve Post</a>
                <a href="/drafts/${draft.id}/reject" class="btn btn-reject">❌ Reject</a>
              </div>
            ` : draft.status === "APPROVED" ? `
              <p style="color: #34d399; font-weight: bold;">✓ This post has been approved by human review and is ready for Hermes to publish.</p>
            ` : draft.status === "PUBLISHED" ? `
              <p style="color: #93c5fd; font-weight: bold;">✓ Published to LinkedIn at ${new Date(draft.publishedAt).toLocaleString()}${draft.postId ? ` (Post ID: ${draft.postId})` : ""}</p>
            ` : `
              <p style="color: #f87171; font-weight: bold;">✗ This post was rejected.</p>
            `}
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// 1-Tap Mobile Approval Route
app.get("/drafts/:id/approve", (req, res) => {
  try {
    const updated = approveDraft(req.params.id, { approvedBy: "web_link" });
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Draft Approved</title>
        <style>
          body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; text-align: center; }
          .card { max-width: 500px; margin: 2rem auto; background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #059669; }
          .btn { display: inline-block; background: #2563eb; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1 style="color: #34d399;">✅ Draft Approved!</h1>
          <p>Draft <strong>${updated.id}</strong> is now officially approved for publishing.</p>
          <p style="color: #94a3b8;">Hermes can now publish this post safely.</p>
          <a href="/drafts/${updated.id}" class="btn">View Draft</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(400).send(`Approval error: ${err.message}`);
  }
});

// Reject Route
app.get("/drafts/:id/reject", (req, res) => {
  try {
    const updated = rejectDraft(req.params.id, { reason: "Rejected via web interface" });
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Draft Rejected</title>
        <style>
          body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; text-align: center; }
          .card { max-width: 500px; margin: 2rem auto; background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #dc2626; }
          .btn { display: inline-block; background: #2563eb; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1 style="color: #f87171;">❌ Draft Rejected</h1>
          <p>Draft <strong>${updated.id}</strong> has been marked as REJECTED.</p>
          <a href="/drafts/${updated.id}" class="btn">Back to Draft</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(400).send(`Rejection error: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`LinkedIn Hermes Server running at: http://localhost:${PORT}`);
  console.log(`Drafts & Approval Center:          http://localhost:${PORT}/drafts`);
  console.log(`OAuth Connection:                  http://localhost:${PORT}/auth/linkedin`);
  console.log(`====================================================`);
});

