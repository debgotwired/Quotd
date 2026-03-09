/**
 * Security & Input Validation Tests
 *
 * Tests for XSS, injection, and input validation vulnerabilities.
 * Based on OWASP Top 10 and Google's security testing practices.
 */

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// Input validation schemas (should match what's used in API routes)
const InterviewCreateSchema = z.object({
  customer_company: z.string().min(1).max(200),
  product_name: z.string().min(1).max(200),
});

const AnswerSubmitSchema = z.object({
  answer: z.string().min(1).max(10000),
  attachment: z.string().optional(),
});

const TokenSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/);

describe("Input Validation Security", () => {
  describe("Interview Creation", () => {
    it("rejects empty company name", () => {
      const result = InterviewCreateSchema.safeParse({
        customer_company: "",
        product_name: "Product",
      });

      expect(result.success).toBe(false);
    });

    it("rejects empty product name", () => {
      const result = InterviewCreateSchema.safeParse({
        customer_company: "Company",
        product_name: "",
      });

      expect(result.success).toBe(false);
    });

    it("rejects overly long company name", () => {
      const result = InterviewCreateSchema.safeParse({
        customer_company: "A".repeat(201),
        product_name: "Product",
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid input", () => {
      const result = InterviewCreateSchema.safeParse({
        customer_company: "Acme Corp",
        product_name: "TestProduct",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Answer Submission", () => {
    it("rejects empty answers", () => {
      const result = AnswerSubmitSchema.safeParse({
        answer: "",
      });

      expect(result.success).toBe(false);
    });

    it("rejects extremely long answers", () => {
      const result = AnswerSubmitSchema.safeParse({
        answer: "A".repeat(10001),
      });

      expect(result.success).toBe(false);
    });

    it("accepts valid answers", () => {
      const result = AnswerSubmitSchema.safeParse({
        answer: "We saved 4 hours per week using the product.",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Token Validation", () => {
    it("accepts alphanumeric tokens", () => {
      expect(TokenSchema.safeParse("abc123XYZ").success).toBe(true);
    });

    it("accepts tokens with hyphens and underscores", () => {
      expect(TokenSchema.safeParse("abc-123_XYZ").success).toBe(true);
    });

    it("rejects tokens with special characters", () => {
      const maliciousTokens = [
        "abc123; DROP TABLE--",
        "../../../etc/passwd",
        "<script>alert(1)</script>",
        "token\nwith\nnewlines",
        "token with spaces",
      ];

      maliciousTokens.forEach((token) => {
        expect(TokenSchema.safeParse(token).success).toBe(false);
      });
    });

    it("rejects empty tokens", () => {
      expect(TokenSchema.safeParse("").success).toBe(false);
    });
  });
});

describe("XSS Prevention", () => {
  const escapeHtml = (str: string): string => {
    const htmlEntities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return str.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
  };

  describe("HTML Escaping", () => {
    it("escapes script tags", () => {
      const malicious = '<script>alert("XSS")</script>';
      const escaped = escapeHtml(malicious);

      expect(escaped).not.toContain("<script>");
      expect(escaped).toContain("&lt;script&gt;");
    });

    it("escapes event handlers", () => {
      const malicious = '<img src="x" onerror="alert(1)">';
      const escaped = escapeHtml(malicious);

      // The string still contains "onerror=" but quotes are escaped
      // making it safe - the key is that < and > are escaped
      expect(escaped).not.toContain("<img");
      expect(escaped).toContain("&lt;img");
      expect(escaped).toContain("&quot;");
    });

    it("escapes quotes", () => {
      const malicious = `" onclick="alert('XSS')"`;
      const escaped = escapeHtml(malicious);

      expect(escaped).not.toContain('" onclick');
      expect(escaped).toContain("&quot;");
    });

    it("escapes ampersands", () => {
      const text = "Tom & Jerry";
      const escaped = escapeHtml(text);

      expect(escaped).toBe("Tom &amp; Jerry");
    });
  });

  describe("Content Sanitization", () => {
    it("removes javascript: URLs", () => {
      const sanitizeUrl = (url: string): string | null => {
        if (url.toLowerCase().startsWith("javascript:")) return null;
        if (url.toLowerCase().startsWith("data:")) return null;
        return url;
      };

      expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
      expect(sanitizeUrl("JAVASCRIPT:alert(1)")).toBeNull();
      expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
      expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
    });
  });
});

describe("SQL Injection Prevention", () => {
  // Note: Supabase uses parameterized queries, but we test input sanitization anyway

  describe("Dangerous Input Detection", () => {
    const containsSqlInjection = (input: string): boolean => {
      const patterns = [
        /'\s*or\s*'1'\s*=\s*'1/i,
        /;\s*drop\s+table/i,
        /;\s*delete\s+from/i,
        /union\s+select/i,
        /'\s*;\s*--/i,
      ];
      return patterns.some((pattern) => pattern.test(input));
    };

    it("detects OR injection", () => {
      expect(containsSqlInjection("' or '1'='1")).toBe(true);
    });

    it("detects DROP TABLE", () => {
      expect(containsSqlInjection("'; DROP TABLE users; --")).toBe(true);
    });

    it("detects UNION SELECT", () => {
      expect(containsSqlInjection("' UNION SELECT * FROM users --")).toBe(true);
    });

    it("allows normal input", () => {
      expect(containsSqlInjection("Acme Corp")).toBe(false);
      expect(containsSqlInjection("We saved 50% on costs")).toBe(false);
    });
  });
});

describe("Path Traversal Prevention", () => {
  describe("File Path Validation", () => {
    const isPathSafe = (path: string): boolean => {
      // Reject path traversal attempts
      if (path.includes("..")) return false;
      if (path.includes("~")) return false;
      if (path.startsWith("/")) return false;
      // Only allow alphanumeric, hyphens, underscores, and forward slashes
      return /^[a-zA-Z0-9_\-\/\.]+$/.test(path);
    };

    it("rejects parent directory traversal", () => {
      expect(isPathSafe("../../../etc/passwd")).toBe(false);
      expect(isPathSafe("..\\..\\windows\\system32")).toBe(false);
    });

    it("rejects absolute paths", () => {
      expect(isPathSafe("/etc/passwd")).toBe(false);
    });

    it("rejects home directory references", () => {
      expect(isPathSafe("~/.ssh/id_rsa")).toBe(false);
    });

    it("allows safe paths", () => {
      expect(isPathSafe("interviews/abc123/file.pdf")).toBe(true);
      expect(isPathSafe("uploads/image.png")).toBe(true);
    });
  });
});

describe("Rate Limiting Logic", () => {
  describe("Request Counting", () => {
    class RateLimiter {
      private requests: Map<string, number[]> = new Map();
      private limit: number;
      private windowMs: number;

      constructor(limit: number, windowMs: number) {
        this.limit = limit;
        this.windowMs = windowMs;
      }

      isAllowed(key: string): boolean {
        const now = Date.now();
        const timestamps = this.requests.get(key) || [];

        // Remove old timestamps
        const validTimestamps = timestamps.filter(
          (t) => now - t < this.windowMs
        );

        if (validTimestamps.length >= this.limit) {
          return false;
        }

        validTimestamps.push(now);
        this.requests.set(key, validTimestamps);
        return true;
      }
    }

    it("allows requests under limit", () => {
      const limiter = new RateLimiter(5, 60000); // 5 per minute

      for (let i = 0; i < 5; i++) {
        expect(limiter.isAllowed("user-1")).toBe(true);
      }
    });

    it("blocks requests over limit", () => {
      const limiter = new RateLimiter(5, 60000);

      for (let i = 0; i < 5; i++) {
        limiter.isAllowed("user-2");
      }

      expect(limiter.isAllowed("user-2")).toBe(false);
    });

    it("isolates limits per user", () => {
      const limiter = new RateLimiter(2, 60000);

      limiter.isAllowed("user-a");
      limiter.isAllowed("user-a");

      // user-a is at limit, but user-b should be fine
      expect(limiter.isAllowed("user-a")).toBe(false);
      expect(limiter.isAllowed("user-b")).toBe(true);
    });
  });
});

describe("CORS and Origin Validation", () => {
  describe("Origin Checking", () => {
    const isOriginAllowed = (origin: string, allowedOrigins: string[]): boolean => {
      return allowedOrigins.some((allowed) => {
        if (allowed === "*") return true;
        if (allowed === origin) return true;
        // Support wildcard subdomains
        if (allowed.startsWith("*.")) {
          const domain = allowed.slice(2);
          return origin.endsWith(domain) && origin.includes("://");
        }
        return false;
      });
    };

    it("allows exact origin match", () => {
      const allowed = ["https://example.com"];
      expect(isOriginAllowed("https://example.com", allowed)).toBe(true);
    });

    it("rejects mismatched origins", () => {
      const allowed = ["https://example.com"];
      expect(isOriginAllowed("https://evil.com", allowed)).toBe(false);
    });

    it("handles wildcard correctly", () => {
      const allowed = ["*"];
      expect(isOriginAllowed("https://any-site.com", allowed)).toBe(true);
    });

    it("handles subdomain wildcards", () => {
      const allowed = ["*.example.com"];
      expect(isOriginAllowed("https://app.example.com", allowed)).toBe(true);
      expect(isOriginAllowed("https://evil.com", allowed)).toBe(false);
    });
  });
});

describe("File Upload Security", () => {
  describe("File Type Validation", () => {
    const ALLOWED_TYPES = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
    ];

    const isFileTypeAllowed = (mimeType: string): boolean => {
      return ALLOWED_TYPES.includes(mimeType.toLowerCase());
    };

    it("allows images", () => {
      expect(isFileTypeAllowed("image/jpeg")).toBe(true);
      expect(isFileTypeAllowed("image/png")).toBe(true);
    });

    it("allows PDFs", () => {
      expect(isFileTypeAllowed("application/pdf")).toBe(true);
    });

    it("rejects executables", () => {
      expect(isFileTypeAllowed("application/x-executable")).toBe(false);
      expect(isFileTypeAllowed("application/x-msdownload")).toBe(false);
    });

    it("rejects HTML files", () => {
      expect(isFileTypeAllowed("text/html")).toBe(false);
    });

    it("rejects scripts", () => {
      expect(isFileTypeAllowed("application/javascript")).toBe(false);
      expect(isFileTypeAllowed("text/javascript")).toBe(false);
    });
  });

  describe("File Size Limits", () => {
    const MAX_SIZE_MB = 50;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    const isFileSizeAllowed = (sizeBytes: number): boolean => {
      return sizeBytes <= MAX_SIZE_BYTES;
    };

    it("allows files under limit", () => {
      expect(isFileSizeAllowed(1024 * 1024)).toBe(true); // 1 MB
      expect(isFileSizeAllowed(49 * 1024 * 1024)).toBe(true); // 49 MB
    });

    it("rejects files over limit", () => {
      expect(isFileSizeAllowed(51 * 1024 * 1024)).toBe(false); // 51 MB
      expect(isFileSizeAllowed(100 * 1024 * 1024)).toBe(false); // 100 MB
    });

    it("allows exactly max size", () => {
      expect(isFileSizeAllowed(MAX_SIZE_BYTES)).toBe(true);
    });
  });

  describe("Filename Sanitization", () => {
    const sanitizeFilename = (filename: string): string => {
      return filename
        .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special chars
        .replace(/\.{2,}/g, ".") // Prevent double dots
        .replace(/^\./, "_") // No leading dots
        .slice(0, 255); // Max length
    };

    it("sanitizes special characters", () => {
      expect(sanitizeFilename("file<>:name.pdf")).toBe("file___name.pdf");
    });

    it("prevents directory traversal", () => {
      const result = sanitizeFilename("../../../etc/passwd");
      // Dots become underscores, slashes become underscores
      expect(result).not.toContain("..");
      expect(result).not.toContain("/");
      expect(result).toContain("etc_passwd");
    });

    it("removes null bytes", () => {
      expect(sanitizeFilename("file\x00.pdf")).toBe("file_.pdf");
    });

    it("limits filename length", () => {
      const longName = "a".repeat(300) + ".pdf";
      expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(255);
    });

    it("prevents hidden files", () => {
      expect(sanitizeFilename(".htaccess")).toBe("_htaccess");
    });
  });
});
