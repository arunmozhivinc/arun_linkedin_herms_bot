import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "node:crypto";
import { LinkedInClient } from "./linkedin.client";

@Injectable()
export class LinkedInOAuthService {
  private readonly logger = new Logger(LinkedInOAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly client: LinkedInClient
  ) {}

  getAuthorizationUrl(userId: string): { url: string; state: string } {
    const clientId = this.config.get<string>("linkedin.clientId");
    const redirectUri = this.config.get<string>("linkedin.redirectUri");

    if (!clientId) {
      throw new Error("LINKEDIN_CLIENT_ID is not configured in environment.");
    }

    // Embed userId into state to bind the callback directly to the Telegram user
    const randomNonce = crypto.randomBytes(16).toString("hex");
    const state = `${userId}:${randomNonce}`;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: "openid profile email w_member_social",
    });

    return {
      url: `https://www.linkedin.com/oauth/v2/authorization?${params}`,
      state,
    };
  }

  async exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    expiresIn: number;
    scope: string;
    memberUrn: string;
    profileName: string;
  }> {
    const clientId = this.config.get<string>("linkedin.clientId");
    const clientSecret = this.config.get<string>("linkedin.clientSecret");
    const redirectUri = this.config.get<string>("linkedin.redirectUri");

    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      this.logger.error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
      throw new Error(`LinkedIn token exchange failed: ${tokenData.error_description || tokenData.error}`);
    }

    // Retrieve user profile to store member URN
    const profile = await this.client.getUserInfo(tokenData.access_token);
    const memberUrn = `urn:li:person:${profile.sub}`;
    const profileName = profile.name || `${profile.given_name || ""} ${profile.family_name || ""}`.trim();

    return {
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      memberUrn,
      profileName,
    };
  }
}

