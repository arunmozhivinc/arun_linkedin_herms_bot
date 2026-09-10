/**
 * Retrieves the currently authenticated member profile.
 */
export async function getLinkedInProfile(accessToken) {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `LinkedIn profile request failed (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}

