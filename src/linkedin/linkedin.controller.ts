import { Controller, Get, Query, Res, BadRequestException } from "@nestjs/common";
import { Response } from "express";
import { LinkedInOAuthService } from "./linkedin-oauth.service";
import { UsersService } from "../users/users.service";

@Controller("auth/linkedin")
export class LinkedInController {
  constructor(
    private readonly oauthService: LinkedInOAuthService,
    private readonly usersService: UsersService
  ) {}

  @Get()
  login(@Query("userId") userId: string, @Res() res: Response) {
    const targetUserId = userId || "default";
    const { url } = this.oauthService.getAuthorizationUrl(targetUserId);
    return res.redirect(url);
  }

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string,
    @Query("error_description") errorDesc: string,
    @Res() res: Response
  ) {
    if (error) {
      throw new BadRequestException(`LinkedIn authorization failed: ${errorDesc || error}`);
    }

    if (!code || !state) {
      throw new BadRequestException("Missing authorization code or state.");
    }

    const userId = state.split(":")[0] || "default";

    try {
      const tokens = await this.oauthService.exchangeCodeForToken(code);
      await this.usersService.updateLinkedInTokens(userId, tokens);

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>LinkedIn Connected</title>
          <style>
            body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; text-align: center; }
            .card { max-width: 500px; margin: 3rem auto; background: #1e293b; padding: 2.5rem; border-radius: 12px; border: 1px solid #059669; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1 style="color: #34d399;">🎉 LinkedIn Connected!</h1>
            <p>Authenticated as: <strong>${tokens.profileName}</strong></p>
            <p style="color: #94a3b8;">Your account is ready for daily automated drafting with Hermes.</p>
            <p style="margin-top: 1.5rem; font-weight: bold;">You can now close this tab and return to Telegram.</p>
          </div>
        </body>
        </html>
      `);
    } catch (err: any) {
      return res.status(500).send(`OAuth callback processing error: ${err.message}`);
    }
  }
}

