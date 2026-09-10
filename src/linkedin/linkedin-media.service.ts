import { Injectable, Logger } from "@nestjs/common";
import * as fs from "node:fs";
import { LinkedInClient } from "./linkedin.client";

@Injectable()
export class LinkedInMediaService {
  private readonly logger = new Logger(LinkedInMediaService.name);

  constructor(private readonly client: LinkedInClient) {}

  async uploadImage(accessToken: string, authorUrn: string, imagePath: string): Promise<string> {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Local image file not found: ${imagePath}`);
    }

    const imageBuffer = fs.readFileSync(imagePath);

    // Step 1: Initialize image upload
    this.logger.log(`Initializing LinkedIn image upload for ${authorUrn}...`);
    const initResponse = await this.client.request<{
      value: {
        uploadUrl: string;
        image: string;
      };
    }>("https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST",
      token: accessToken,
      body: {
        initializeUploadRequest: {
          owner: authorUrn,
        },
      },
    });

    const uploadUrl = initResponse.data?.value?.uploadUrl;
    const imageUrn = initResponse.data?.value?.image;

    if (!uploadUrl || !imageUrn) {
      throw new Error("LinkedIn image upload initialization failed: missing uploadUrl or image URN");
    }

    // Step 2: Stream raw binary to signed uploadUrl
    this.logger.log(`Uploading binary image buffer (${imageBuffer.length} bytes) to LinkedIn...`);
    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "image/jpeg",
      },
      body: imageBuffer,
    });

    if (!putResponse.ok) {
      const errText = await putResponse.text();
      throw new Error(`LinkedIn binary image PUT failed (${putResponse.status}): ${errText}`);
    }

    this.logger.log(`LinkedIn image upload successful: ${imageUrn}`);
    return imageUrn;
  }
}

