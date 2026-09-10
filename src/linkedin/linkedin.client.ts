import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class LinkedInClient {
  private readonly logger = new Logger(LinkedInClient.name);
  readonly apiVersion = "202608";
  readonly restliVersion = "2.0.0";

  async request<T = any>(
    url: string,
    options: {
      method?: string;
      token: string;
      body?: any;
      contentType?: string;
      headers?: Record<string, string>;
    }
  ): Promise<{ status: number; headers: Headers; data: T }> {
    const { method = "GET", token, body, contentType = "application/json", headers = {} } = options;

    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Linkedin-Version": this.apiVersion,
      "X-Restli-Protocol-Version": this.restliVersion,
      ...headers,
    };

    if (contentType && !headers["Content-Type"]) {
      reqHeaders["Content-Type"] = contentType;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: reqHeaders,
    };

    if (body) {
      fetchOptions.body = (typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)) as any;
    }

    const response = await fetch(url, fetchOptions);
    const text = await response.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!response.ok) {
      const errorMsg = typeof data === "object" && data !== null
        ? (data.message || JSON.stringify(data))
        : String(data);
      this.logger.error(`LinkedIn API Error (${response.status}): ${errorMsg}`);
      throw new Error(`LinkedIn API error (${response.status} ${response.statusText}): ${errorMsg}`);
    }

    return {
      status: response.status,
      headers: response.headers,
      data,
    };
  }

  async getUserInfo(token: string): Promise<any> {
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Failed to fetch LinkedIn user info: ${JSON.stringify(data)}`);
    }

    return data;
  }
}
