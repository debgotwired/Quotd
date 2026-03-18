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

interface InterviewCompletedEmailProps {
  customerCompany: string;
  productName: string;
  interviewUrl: string;
  brandColor?: string;
  logoUrl?: string | null;
}

export function InterviewCompletedEmail({
  customerCompany,
  productName,
  interviewUrl,
  brandColor = "#1a1a1a",
  logoUrl,
}: InterviewCompletedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Interview completed: {customerCompany} x {productName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {logoUrl && (
            <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
              <img src={logoUrl} alt="" style={{ height: "40px", margin: "0 auto" }} />
            </Section>
          )}
          <Heading style={{ ...heading, color: brandColor }}>Interview Completed</Heading>
          <Text style={paragraph}>
            Great news! The case study interview with{" "}
            <strong>{customerCompany}</strong> about{" "}
            <strong>{productName}</strong> has been completed.
          </Text>
          <Text style={paragraph}>
            The draft case study is ready for your review.
          </Text>
          <Section style={buttonContainer}>
            <Button style={{ ...button, backgroundColor: brandColor }} href={interviewUrl}>
              View Case Study
            </Button>
          </Section>
          <Text style={footer}>
            You&apos;re receiving this because you created this interview on
            Quotd.
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

export default InterviewCompletedEmail;
