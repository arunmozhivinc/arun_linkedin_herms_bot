import { linkedInFetch } from "./client.js";

/**
 * Publishes a post to LinkedIn REST API (/rest/posts).
 * Supports text-only posts or posts with attached media (image URN).
 */
export async function publishLinkedInPost({ accessToken, authorUrn, commentary, mediaImageUrn = null, mediaTitle = "Visual" }) {
  if (!accessToken) {
    throw new Error("Missing LinkedIn access token.");
  }

  if (!authorUrn) {
    throw new Error("Missing author URN (e.g., urn:li:person:...).");
  }

  if (!commentary || commentary.trim().length === 0) {
    throw new Error("Post commentary cannot be empty.");
  }

  const payload = {
    author: authorUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (mediaImageUrn) {
    payload.content = {
      media: {
        title: mediaTitle,
        id: mediaImageUrn,
      },
    };
  }

  const response = await linkedInFetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    token: accessToken,
    body: payload,
  });

  const postId = response.headers.get("x-restli-id");

  return {
    status: response.status,
    postId: postId || null,
    authorUrn,
  };
}

