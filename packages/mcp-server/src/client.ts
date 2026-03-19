export class QuotdClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || "https://app.quotd.io";
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

    // Handle text responses
    const contentType = res.headers.get("content-type") || "";
    if (
      contentType.includes("text/markdown") ||
      contentType.includes("text/plain")
    ) {
      return { text: await res.text(), contentType } as T;
    }

    return (await res.json()) as T;
  }

  async listInterviews(params?: { status?: string; page?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    const query = qs.toString();
    return this.request<{ data: unknown[]; pagination: unknown }>(
      "GET",
      `/interviews${query ? `?${query}` : ""}`
    );
  }

  async getInterview(id: string) {
    return this.request<{ data: Record<string, unknown> }>(
      "GET",
      `/interviews/${id}`
    );
  }

  async createInterview(data: Record<string, unknown>) {
    return this.request<{ data: Record<string, unknown> }>(
      "POST",
      "/interviews",
      data
    );
  }

  async getDraft(id: string) {
    return this.request<{
      data: { draft_content: string; customer_draft_content: string | null };
    }>("GET", `/interviews/${id}/draft`);
  }

  async getMessages(id: string) {
    return this.request<{ data: unknown[] }>(
      "GET",
      `/interviews/${id}/messages`
    );
  }

  async getAnalytics(id: string) {
    return this.request<{ data: Record<string, unknown> }>(
      "GET",
      `/interviews/${id}/analytics`
    );
  }

  async generateFormat(id: string, format: string) {
    return this.request<{ data: Record<string, unknown> }>(
      "POST",
      `/interviews/${id}/formats`,
      { format }
    );
  }

  async exportDraft(id: string, format: string) {
    return this.request<{ text: string; contentType: string }>(
      "GET",
      `/interviews/${id}/export?format=${format}`
    );
  }

  async listTeams() {
    return this.request<{ data: unknown[] }>("GET", "/teams");
  }

  async getProfile() {
    return this.request<{ data: Record<string, unknown> }>("GET", "/profile");
  }
}
