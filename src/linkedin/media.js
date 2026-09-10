import fs from "node:fs";
import { linkedInFetch } from "./client.js";

/**
 * Uploads an image to LinkedIn using the 2-step REST Images API.
 * Step 1: Initialize upload -> receives uploadUrl and image URN.
 * Step 2: PUT image binary directly to uploadUrl.
 */
export async function uploadImageToLinkedIn({ accessToken, authorUrn, imagePath, imageBuffer, mimeType = "image/jpeg" }) {
  let buffer = imageBuffer;
  if (!buffer && imagePath) {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found at path: ${imagePath}`);
    }
    buffer = fs.readFileSync(imagePath);
  }

  if (!buffer) {
    throw new Error("No image buffer or valid image path provided for upload.");
  }

  // Step 1: Initialize upload
  const initResponse = await linkedInFetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    token: accessToken,
    body: {
      initializeUploadRequest: {
        owner: authorUrn,
      },
    },
  });

  const uploadData = initResponse.data?.value;
  if (!uploadData?.uploadUrl || !uploadData?.image) {
    throw new Error(`LinkedIn image upload initialization did not return uploadUrl and image URN: ${JSON.stringify(initResponse.data)}`);
  }

  const { uploadUrl, image: imageUrn } = uploadData;

  // Step 2: Upload raw binary to uploadUrl
  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
    body: buffer,
  });

  if (!putResponse.ok) {
    const errorText = await putResponse.text();
    throw new Error(`Failed to upload image binary to LinkedIn (${putResponse.status}): ${errorText}`);
  }

  return {
    imageUrn,
    status: putResponse.status,
  };
}

