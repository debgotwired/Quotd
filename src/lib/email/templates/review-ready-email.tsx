import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface ReviewReadyEmailProps {
  customerCompany: string;
  productName: string;
  reviewUrl: string;
  brandColor?: string;
  logoUrl?: string | null;
}

export function ReviewReadyEmail({
  customerCompany,
  productName,
  reviewUrl,
  brandColor = "#1a1a1a",
  logoUrl,
}: ReviewReadyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Your case study is ready for review: {customerCompany} x {productName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {logoUrl && (
            <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
              <img src={logoUrl} alt="" style={{ height: "40px", margin: "0 auto" }} />
            </Section>
          )}
          <Heading style={{ ...heading, color: brandColor }}>Your Case Study is Ready</Heading>
          <Text style={paragraph}>
            Thank you for completing the interview about{" "}
            <strong>{productName}</strong>! Your case study draft is now ready
            for your review.
          </Text>
          <Text style={paragraph}>
            Please review the draft, approve or flag sections, and submit your
            feedback. You can also make edits to the text directly.
          </Text>
          <Section style={buttonContainer}>
            <Button style={{ ...button, backgroundColor: brandColor }} href={reviewUrl}>
              Review Case Study
            </Button>
          </Section>
          <Text style={footer}>
            You&apos;re receiving this because you completed a case study
            interview for {customerCompany} on Quotd.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  marginTop: "40px",
  marginBottom: "40px",
  borderRadius: "8px",
  maxWidth: "480px",
};

const heading = {
  color: "#1a1a1a",
  fontSize: "24px",
  fontWeight: "600",
  textAlign: "center" as const,
  margin: "0 0 24px",
};

const paragraph = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "26px",
  textAlign: "center" as const,
  margin: "0 0 16px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#1a1a1a",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "20px",
  textAlign: "center" as const,
  marginTop: "24px",
};

export default ReviewReadyEmail;
