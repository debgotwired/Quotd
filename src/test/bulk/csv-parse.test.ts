/**
 * CSV Parser Tests
 *
 * Tests for the bulk interview CSV parser.
 * Covers valid CSV, missing fields, empty rows, special characters,
 * column aliases, and validation edge cases.
 */

import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/csv/parse";

describe("CSV Parser", () => {
  describe("Valid CSV", () => {
    it("parses basic CSV with required fields", () => {
      const csv = `customer_company,product_name
Acme Corp,Quotd
Globex Inc,Quotd`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].customer_company).toBe("Acme Corp");
      expect(result.rows[0].product_name).toBe("Quotd");
      expect(result.rows[1].customer_company).toBe("Globex Inc");
    });

    it("parses CSV with all optional fields", () => {
      const csv = `customer_company,product_name,customer_email,linkedin_profile_url,company_website_url,interview_tone,interview_focus,target_audience,question_limit
Acme Corp,Quotd,alice@acme.com,https://linkedin.com/in/alice,https://acme.com,formal,roi,c_suite,20`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(1);

      const row = result.rows[0];
      expect(row.customer_company).toBe("Acme Corp");
      expect(row.product_name).toBe("Quotd");
      expect(row.customer_email).toBe("alice@acme.com");
      expect(row.linkedin_profile_url).toBe("https://linkedin.com/in/alice");
      expect(row.company_website_url).toBe("https://acme.com");
      expect(row.interview_tone).toBe("formal");
      expect(row.interview_focus).toBe("roi");
      expect(row.target_audience).toBe("c_suite");
      expect(row.question_limit).toBe(20);
    });

    it("handles empty optional fields gracefully", () => {
      const csv = `customer_company,product_name,customer_email
Acme Corp,Quotd,
Globex Inc,Quotd,bob@globex.com`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].customer_email).toBeUndefined();
      expect(result.rows[1].customer_email).toBe("bob@globex.com");
    });

    it("parses single row CSV", () => {
      const csv = `customer_company,product_name
Acme Corp,Quotd`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(1);
    });

    it("handles Windows-style line endings (CRLF)", () => {
      const csv = "customer_company,product_name\r\nAcme Corp,Quotd\r\nGlobex Inc,Quotd";

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
    });
  });

  describe("Column Aliases", () => {
    it("accepts 'company' as alias for customer_company", () => {
      const csv = `company,product_name
Acme Corp,Quotd`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].customer_company).toBe("Acme Corp");
    });

    it("accepts 'email' as alias for customer_email", () => {
      const csv = `customer_company,product_name,email
Acme Corp,Quotd,alice@acme.com`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].customer_email).toBe("alice@acme.com");
    });

    it("accepts 'linkedin' as alias for linkedin_profile_url", () => {
      const csv = `customer_company,product_name,linkedin
Acme Corp,Quotd,https://linkedin.com/in/alice`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].linkedin_profile_url).toBe("https://linkedin.com/in/alice");
    });

    it("accepts 'website' as alias for company_website_url", () => {
      const csv = `customer_company,product_name,website
Acme Corp,Quotd,https://acme.com`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].company_website_url).toBe("https://acme.com");
    });

    it("accepts 'tone' as alias for interview_tone", () => {
      const csv = `customer_company,product_name,tone
Acme Corp,Quotd,formal`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].interview_tone).toBe("formal");
    });

    it("accepts 'questions' as alias for question_limit", () => {
      const csv = `customer_company,product_name,questions
Acme Corp,Quotd,20`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].question_limit).toBe(20);
    });
  });

  describe("Missing Required Fields", () => {
    it("errors when customer_company column is missing", () => {
      const csv = `product_name
Quotd`;

      const result = parseCsv(csv);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("customer_company");
    });

    it("errors when product_name column is missing", () => {
      const csv = `customer_company
Acme Corp`;

      const result = parseCsv(csv);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("product_name");
    });

    it("errors when customer_company value is empty in a row", () => {
      const csv = `customer_company,product_name
,Quotd`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("customer_company");
    });

    it("errors when product_name value is empty in a row", () => {
      const csv = `customer_company,product_name
Acme Corp,`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("product_name");
    });
  });

  describe("Empty Rows", () => {
    it("skips empty lines between data rows", () => {
      const csv = `customer_company,product_name

Acme Corp,Quotd

Globex Inc,Quotd
`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
    });

    it("skips trailing empty lines", () => {
      const csv = `customer_company,product_name
Acme Corp,Quotd


`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(1);
    });

    it("returns error for completely empty CSV", () => {
      const result = parseCsv("");

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.rows).toHaveLength(0);
    });

    it("returns error for CSV with only whitespace", () => {
      const result = parseCsv("   \n  \n  ");

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("Special Characters", () => {
    it("handles quoted fields with commas", () => {
      const csv = `customer_company,product_name
"Acme, Corp",Quotd`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].customer_company).toBe("Acme, Corp");
    });

    it("handles escaped quotes (double quotes)", () => {
      const csv = `customer_company,product_name
"Acme ""Big"" Corp",Quotd`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].customer_company).toBe('Acme "Big" Corp');
    });

    it("handles quoted fields with newlines-like content", () => {
      const csv = `customer_company,product_name
Acme Corp,Quotd
"Globex Inc",Quotd`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
    });

    it("handles unicode characters", () => {
      const csv = `customer_company,product_name
Uber Gmbh,Quotd
Cafe Creme,Quotd`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].customer_company).toBe("Uber Gmbh");
    });

    it("trims whitespace from values", () => {
      const csv = `customer_company,product_name
  Acme Corp  ,  Quotd  `;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].customer_company).toBe("Acme Corp");
      expect(result.rows[0].product_name).toBe("Quotd");
    });
  });

  describe("Validation", () => {
    it("rejects invalid email format", () => {
      const csv = `customer_company,product_name,customer_email
Acme Corp,Quotd,not-an-email`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("customer_email");
    });

    it("rejects invalid URL for linkedin", () => {
      const csv = `customer_company,product_name,linkedin_profile_url
Acme Corp,Quotd,not-a-url`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("linkedin_profile_url");
    });

    it("rejects invalid URL for website", () => {
      const csv = `customer_company,product_name,company_website_url
Acme Corp,Quotd,not-a-url`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("company_website_url");
    });

    it("rejects invalid interview tone", () => {
      const csv = `customer_company,product_name,interview_tone
Acme Corp,Quotd,aggressive`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("interview_tone");
    });

    it("rejects invalid interview focus", () => {
      const csv = `customer_company,product_name,interview_focus
Acme Corp,Quotd,random`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("interview_focus");
    });

    it("rejects invalid target audience", () => {
      const csv = `customer_company,product_name,target_audience
Acme Corp,Quotd,aliens`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("target_audience");
    });

    it("rejects question limit below 5", () => {
      const csv = `customer_company,product_name,question_limit
Acme Corp,Quotd,2`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("question_limit");
    });

    it("rejects question limit above 30", () => {
      const csv = `customer_company,product_name,question_limit
Acme Corp,Quotd,50`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("question_limit");
    });

    it("rejects non-numeric question limit", () => {
      const csv = `customer_company,product_name,question_limit
Acme Corp,Quotd,many`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("question_limit");
    });

    it("rejects company name longer than 200 characters", () => {
      const csv = `customer_company,product_name
${"A".repeat(201)},Quotd`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("customer_company");
    });

    it("rejects product name longer than 200 characters", () => {
      const csv = `customer_company,product_name
Acme Corp,${"P".repeat(201)}`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe("product_name");
    });
  });

  describe("Partial Success", () => {
    it("returns valid rows alongside errors", () => {
      const csv = `customer_company,product_name,customer_email
Acme Corp,Quotd,alice@acme.com
,Quotd,invalid
Globex Inc,Quotd,bob@globex.com`;

      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.rows[0].customer_company).toBe("Acme Corp");
      expect(result.rows[1].customer_company).toBe("Globex Inc");
    });

    it("provides row numbers in errors", () => {
      const csv = `customer_company,product_name
Acme Corp,Quotd
,Missing
Globex Inc,Quotd`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(3); // Row 3 (1-indexed, header is row 1)
    });
  });

  describe("Case Insensitivity", () => {
    it("accepts uppercase tone values", () => {
      const csv = `customer_company,product_name,interview_tone
Acme Corp,Quotd,FORMAL`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].interview_tone).toBe("formal");
    });

    it("accepts mixed-case focus values", () => {
      const csv = `customer_company,product_name,interview_focus
Acme Corp,Quotd,Storytelling`;

      const result = parseCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].interview_focus).toBe("storytelling");
    });
  });
});
