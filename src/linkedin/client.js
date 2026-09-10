export const LINKEDIN_API_VERSION = "202608";
export const RESTLI_PROTOCOL_VERSION = "2.0.0";

/**
 * Executes an HTTP request to LinkedIn REST API with standard required headers.
 */
export async function linkedInFetch(url, { method = "GET", token, body, contentType = "application/json", headers = {} } = {}) {
  const reqHeaders = {
    Authorization: `Bearer ${token}`,
    "Linkedin-Version": LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": RESTLI_PROTOCOL_VERSION,
    ...headers,
  };

  if (contentType && !headers["Content-Type"]) {
    reqHeaders["Content-Type"] = contentType;
  }

  const options = {
    method,
    headers: reqHeaders,
  };

  if (body) {
    options.body = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const responseText = await response.text();

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }

  if (!response.ok) {
    const errorMsg = typeof data === "object" && data !== null
      ? (data.message || JSON.stringify(data))
      : String(data);
    throw new Error(`LinkedIn API error (${response.status} ${response.statusText}): ${errorMsg}`);
  }

  return {
    status: response.status,
    headers: response.headers,
    data,
  };
}

