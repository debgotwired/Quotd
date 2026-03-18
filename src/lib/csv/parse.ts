import type { InterviewTone, InterviewFocus, TargetAudience } from "@/lib/supabase/types";

export type CsvInterviewRow = {
  customer_company: string;
  product_name: string;
  customer_email?: string;
  linkedin_profile_url?: string;
  company_website_url?: string;
  interview_tone?: InterviewTone;
  interview_focus?: InterviewFocus;
  target_audience?: TargetAudience;
  question_limit?: number;
};

export type CsvValidationError = {
  row: number;
  field: string;
  message: string;
};

export type CsvParseResult = {
  rows: CsvInterviewRow[];
  errors: CsvValidationError[];
};

const REQUIRED_COLUMNS = ["customer_company", "product_name"] as const;

const VALID_TONES: InterviewTone[] = ["formal", "conversational", "technical"];
const VALID_FOCUSES: InterviewFocus[] = ["balanced", "roi", "technical", "storytelling"];
const VALID_AUDIENCES: TargetAudience[] = ["general", "c_suite", "technical_buyer", "end_user", "board"];

const COLUMN_ALIASES: Record<string, string> = {
  company: "customer_company",
  customer: "customer_company",
  "company name": "customer_company",
  "customer name": "customer_company",
  product: "product_name",
  "product name": "product_name",
  email: "customer_email",
  "customer email": "customer_email",
  linkedin: "linkedin_profile_url",
  "linkedin url": "linkedin_profile_url",
  "linkedin profile": "linkedin_profile_url",
  website: "company_website_url",
  "company website": "company_website_url",
  "website url": "company_website_url",
  tone: "interview_tone",
  focus: "interview_focus",
  audience: "target_audience",
  "target audience": "target_audience",
  questions: "question_limit",
  "question limit": "question_limit",
  "question count": "question_limit",
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote (double quote)
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

function normalizeColumnName(name: string): string {
  const lower = name.toLowerCase().trim();
  return COLUMN_ALIASES[lower] || lower.replace(/\s+/g, "_");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseCsv(text: string): CsvParseResult {
  const rows: CsvInterviewRow[] = [];
  const errors: CsvValidationError[] = [];

  const lines = text.split(/\r?\n/);

  // Find header line (skip empty lines at the start)
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    errors.push({ row: 0, field: "", message: "CSV is empty" });
    return { rows, errors };
  }

  const headerFields = parseCsvLine(lines[headerIndex]);
  const columns = headerFields.map(normalizeColumnName);

  // Check required columns exist
  for (const required of REQUIRED_COLUMNS) {
    if (!columns.includes(required)) {
      errors.push({
        row: 1,
        field: required,
        message: `Missing required column: ${required}`,
      });
    }
  }

  if (errors.length > 0) {
    return { rows, errors };
  }

  // Parse data rows
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;

    const rowNumber = i + 1; // 1-indexed for user display
    const fields = parseCsvLine(lines[i]);

    // Build row object from columns
    const rowData: Record<string, string> = {};
    for (let j = 0; j < columns.length; j++) {
      if (j < fields.length) {
        rowData[columns[j]] = fields[j];
      }
    }

    // Validate required fields
    const customerCompany = rowData.customer_company?.trim() || "";
    const productName = rowData.product_name?.trim() || "";

    if (!customerCompany) {
      errors.push({
        row: rowNumber,
        field: "customer_company",
        message: "Customer company is required",
      });
      continue;
    }

    if (customerCompany.length > 200) {
      errors.push({
        row: rowNumber,
        field: "customer_company",
        message: "Customer company must be 200 characters or less",
      });
      continue;
    }

    if (!productName) {
      errors.push({
        row: rowNumber,
        field: "product_name",
        message: "Product name is required",
      });
      continue;
    }

    if (productName.length > 200) {
      errors.push({
        row: rowNumber,
        field: "product_name",
        message: "Product name must be 200 characters or less",
      });
      continue;
    }

    const row: CsvInterviewRow = {
      customer_company: customerCompany,
      product_name: productName,
    };

    // Optional fields
    const email = rowData.customer_email?.trim();
    if (email) {
      if (!isValidEmail(email)) {
        errors.push({
          row: rowNumber,
          field: "customer_email",
          message: `Invalid email: ${email}`,
        });
        continue;
      }
      row.customer_email = email;
    }

    const linkedin = rowData.linkedin_profile_url?.trim();
    if (linkedin) {
      if (!isValidUrl(linkedin)) {
        errors.push({
          row: rowNumber,
          field: "linkedin_profile_url",
          message: `Invalid URL: ${linkedin}`,
        });
        continue;
      }
      row.linkedin_profile_url = linkedin;
    }

    const website = rowData.company_website_url?.trim();
    if (website) {
      if (!isValidUrl(website)) {
        errors.push({
          row: rowNumber,
          field: "company_website_url",
          message: `Invalid URL: ${website}`,
        });
        continue;
      }
      row.company_website_url = website;
    }

    const tone = rowData.interview_tone?.trim().toLowerCase();
    if (tone) {
      if (!VALID_TONES.includes(tone as InterviewTone)) {
        errors.push({
          row: rowNumber,
          field: "interview_tone",
          message: `Invalid tone: ${tone}. Must be one of: ${VALID_TONES.join(", ")}`,
        });
        continue;
      }
      row.interview_tone = tone as InterviewTone;
    }

    const focus = rowData.interview_focus?.trim().toLowerCase();
    if (focus) {
      if (!VALID_FOCUSES.includes(focus as InterviewFocus)) {
        errors.push({
          row: rowNumber,
          field: "interview_focus",
          message: `Invalid focus: ${focus}. Must be one of: ${VALID_FOCUSES.join(", ")}`,
        });
        continue;
      }
      row.interview_focus = focus as InterviewFocus;
    }

    const audience = rowData.target_audience?.trim().toLowerCase();
    if (audience) {
      if (!VALID_AUDIENCES.includes(audience as TargetAudience)) {
        errors.push({
          row: rowNumber,
          field: "target_audience",
          message: `Invalid audience: ${audience}. Must be one of: ${VALID_AUDIENCES.join(", ")}`,
        });
        continue;
      }
      row.target_audience = audience as TargetAudience;
    }

    const questionLimit = rowData.question_limit?.trim();
    if (questionLimit) {
      const parsed = parseInt(questionLimit, 10);
      if (isNaN(parsed) || parsed < 5 || parsed > 30) {
        errors.push({
          row: rowNumber,
          field: "question_limit",
          message: `Invalid question limit: ${questionLimit}. Must be between 5 and 30`,
        });
        continue;
      }
      row.question_limit = parsed;
    }

    rows.push(row);
  }

  return { rows, errors };
}
