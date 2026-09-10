import { Controller, Get, Param, Res, NotFoundException } from "@nestjs/common";
import { Response } from "express";
import { DraftsService } from "./drafts.service";

@Controller("drafts")
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Get()
  async listAll(@Res() res: Response) {
    const drafts = await this.draftsService.listDrafts();

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Enterprise LinkedIn Control Center</title>
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
          <h1>🚀 LinkedIn Hermes Control Center (NestJS)</h1>
          <p>Total Managed Drafts: ${drafts.length}</p>
          ${drafts.length === 0 ? "<p>No drafts yet. Scheduled cron or Hermes will post drafts here.</p>" : ""}
          ${drafts.map((d) => `
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-weight: bold; font-size: 1.1rem;">${d.draftId || d.id}</span>
                <span class="badge ${d.status}">${d.status}</span>
              </div>
              <p style="color: #94a3b8; font-size: 0.85rem;">User: ${d.userId} | Topic: ${d.metadata?.topic || "General"} | Type: ${d.postType}</p>
              <p style="white-space: pre-wrap; max-height: 100px; overflow: hidden; text-overflow: ellipsis;">${d.text}</p>
              <div style="margin-top: 1rem;">
                <a href="/drafts/${d.draftId || d.id}" class="btn">View & Review Draft →</a>
              </div>
            </div>
          `).join("")}
        </div>
      </body>
      </html>
    `);
  }

  @Get(":id")
  async viewDraft(@Param("id") id: string, @Res() res: Response) {
    const draft = await this.draftsService.getDraft(id);
    if (!draft) throw new NotFoundException(`Draft ${id} not found.`);

    const imageUrl = draft.media?.url || (draft.media?.localPath ? `/images/${id}.jpg` : null);

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Draft Preview: ${draft.draftId || draft.id}</title>
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
          .btn-reject { background: #dc2626; color: white; flex: 1; }
          a { color: #60a5fa; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <p><a href="/drafts">← Back to All Drafts</a></p>
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h2>${draft.draftId || draft.id}</h2>
              <span class="badge ${draft.status}">${draft.status}</span>
            </div>
            <p style="color: #94a3b8; font-size: 0.9rem;">Topic: <strong>${draft.metadata?.topic || "General"}</strong></p>
            
            <div class="post-text">${draft.text}</div>

            ${imageUrl ? `
              <div>
                <p style="color: #94a3b8; font-size: 0.85rem;">Generated Visual:</p>
                <img src="${imageUrl}" alt="Visual Preview" class="media-preview" />
              </div>
            ` : ""}

            <div style="margin-top: 1.5rem;">
              ${draft.status === "PENDING_APPROVAL" ? `
                <div style="display: flex; gap: 1rem;">
                  <a href="/drafts/${draft.draftId || draft.id}/approve" class="btn btn-approve">✅ Approve Post</a>
                  <a href="/drafts/${draft.draftId || draft.id}/reject" class="btn btn-reject">❌ Reject</a>
                </div>
              ` : draft.status === "APPROVED" ? `
                <p style="color: #34d399; font-weight: bold;">✓ Approved by human review. Ready for Hermes or Cron to publish.</p>
              ` : draft.status === "PUBLISHED" ? `
                <p style="color: #93c5fd; font-weight: bold;">✓ Published to LinkedIn at ${new Date(draft.publishedAt).toLocaleString()}${draft.postId ? ` (ID: ${draft.postId})` : ""}</p>
              ` : `
                <p style="color: #f87171; font-weight: bold;">✗ Rejected</p>
              `}
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  @Get(":id/approve")
  async approveOneTap(@Param("id") id: string, @Res() res: Response) {
    try {
      const updated = await this.draftsService.approveDraft(id, "one_tap_link");
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Approved</title>
          <style>
            body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; text-align: center; }
            .card { max-width: 500px; margin: 2rem auto; background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #059669; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1 style="color: #34d399;">✅ Draft Approved!</h1>
            <p>Draft <strong>${updated.draftId || updated.id}</strong> is now approved.</p>
            <p style="color: #94a3b8;">Hermes / Cron will now publish it safely to LinkedIn.</p>
            <p><a href="/drafts/${updated.draftId || updated.id}" style="color: #60a5fa;">Back to Draft</a></p>
          </div>
        </body>
        </html>
      `);
    } catch (e: any) {
      return res.status(400).send(`Approval error: ${e.message}`);
    }
  }

  @Get(":id/reject")
  async rejectOneTap(@Param("id") id: string, @Res() res: Response) {
    try {
      const updated = await this.draftsService.rejectDraft(id, "Rejected via web interface");
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rejected</title>
          <style>
            body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; text-align: center; }
            .card { max-width: 500px; margin: 2rem auto; background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #dc2626; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1 style="color: #f87171;">❌ Draft Rejected</h1>
            <p>Draft <strong>${updated.draftId || updated.id}</strong> marked as REJECTED.</p>
            <p><a href="/drafts" style="color: #60a5fa;">Back to All Drafts</a></p>
          </div>
        </body>
        </html>
      `);
    } catch (e: any) {
      return res.status(400).send(`Rejection error: ${e.message}`);
    }
  }
}

