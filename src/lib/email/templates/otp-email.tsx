import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface OtpEmailProps {
  code: string;
}

export function OtpEmail({ code }: OtpEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Quotd login code: {code}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Sign in to Quotd</Heading>
          <Section style={codeContainer}>
            <Text style={codeText}>{code}</Text>
          </Section>
          <Text style={paragraph}>
            Enter this code to sign in to your Quotd account. This code will
            expire in 10 minutes.
          </Text>
          <Text style={paragraph}>
            If you didn&apos;t request this code, you can safely ignore this
            email.
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
  maxWidth: "400px",
};

const heading = {
  color: "#1a1a1a",
  fontSize: "24px",
  fontWeight: "600",
  textAlign: "center" as const,
  margin: "0 0 24px",
};

const codeContainer = {
  backgroundColor: "#f4f4f5",
  borderRadius: "8px",
  padding: "24px",
  margin: "24px 0",
};

const codeText = {
  color: "#1a1a1a",
  fontSize: "32px",
  fontWeight: "700",
  textAlign: "center" as const,
  letterSpacing: "0.3em",
  margin: "0",
};

const paragraph = {
  color: "#525f7f",
  fontSize: "14px",
  lineHeight: "24px",
  textAlign: "center" as const,
  margin: "0 0 12px",
};

export default OtpEmail;
