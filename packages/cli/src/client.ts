import { readConfig } from "./config.js";

export class QuotdClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    const config = readConfig();
    this.apiKey = apiKey || config.api_key || "";
    this.baseUrl = baseUrl || config.base_url || "https://app.quotd.io";

    if (!this.apiKey) {
      throw new Error(
        "No API key configured. Run `quotd login` or set QUOTD_API_KEY."
      );
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(
        (errBody as { error?: string }).error ||
          `HTTP ${res.status}: ${res.statusText}`
      );
    }

    // Handle binary responses (export)
    const contentType = res.headers.get("content-type") || "";
    if (
      contentType.includes("application/pdf") ||
      contentType.includes("application/vnd.openxmlformats") ||
      contentType.includes("text/markdown") ||
      contentType.includes("text/plain") ||
      contentType.includes("text/html")
    ) {
      return { buffer: Buffer.from(await res.arrayBuffer()), contentType } as T;
    }

    return (await res.json()) as T;
  }

  // Interviews
  async listInterviews(params?: { status?: string; page?: number; per_page?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    const query = qs.toString();
    return this.request<{
      data: Array<{
        id: string;
        customer_company: string;
        product_name: string;
        status: string;
        created_at: string;
      }>;
      pagination: { page: number; per_page: number; total: number; total_pages: number };
    }>("GET", `/interviews${query ? `?${query}` : ""}`);
  }

  async getInterview(id: string) {
    return this.request<{ data: Record<string, unknown> }>("GET", `/interviews/${id}`);
  }

  async createInterview(data: {
    customer_company: string;
    product_name: string;
    customer_email?: string;
    interview_tone?: string;
    interview_focus?: string;
    target_audience?: string;
    question_limit?: number;
  }) {
    return this.request<{ data: Record<string, unknown> }>("POST", "/interviews", data);
  }

  // Draft
  async getDraft(id: string) {
    return this.request<{ data: { draft_content: string; customer_draft_content: string | null } }>(
      "GET",
      `/interviews/${id}/draft`
    );
  }

  // Messages
  async getMessages(id: string) {
    return this.request<{
      data: Array<{ id: string; role: string; content: string; created_at: string }>;
    }>("GET", `/interviews/${id}/messages`);
  }

  // Analytics
  async getAnalytics(id: string) {
    return this.request<{ data: Record<string, unknown> }>(
      "GET",
      `/interviews/${id}/analytics`
    );
  }

  // Formats
  async listFormats(id: string) {
    return this.request<{ data: Record<string, unknown> }>("GET", `/interviews/${id}/formats`);
  }

  async generateFormat(id: string, format: string) {
    return this.request<{ data: Record<string, unknown> }>("POST", `/interviews/${id}/formats`, {
      format,
    });
  }

  // Export
  async exportDraft(id: string, format: string) {
    return this.request<{ buffer: Buffer; contentType: string }>(
      "GET",
      `/interviews/${id}/export?format=${format}`
    );
  }

  // Teams
  async listTeams() {
    return this.request<{ data: Array<{ id: string; name: string; owner_id: string; created_at: string }> }>(
      "GET",
      "/teams"
    );
  }

  // Profile
  async getProfile() {
    return this.request<{ data: Record<string, unknown> }>("GET", "/profile");
  }

  // Webhooks
  async listWebhooks() {
    return this.request<{ data: Array<Record<string, unknown>> }>("GET", "/webhooks");
  }

  async createWebhook(data: { url: string; events: string[]; secret?: string }) {
    return this.request<{ data: Record<string, unknown> }>("POST", "/webhooks", data);
  }

  async deleteWebhook(id: string) {
    return this.request<{ success: boolean }>("DELETE", `/webhooks/${id}`);
  }
}
