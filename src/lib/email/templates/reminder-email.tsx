import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface ReminderEmailProps {
  subject: string;
  body: string;
  reviewUrl: string;
  snoozeUrl: string;
  brandColor?: string;
  logoUrl?: string | null;
}

export function ReminderEmail({
  subject,
  body,
  reviewUrl,
  snoozeUrl,
  brandColor = "#1a1a1a",
  logoUrl,
}: ReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          {logoUrl && (
            <Section
              style={{ textAlign: "center" as const, marginBottom: "24px" }}
            >
              <img
                src={logoUrl}
                alt=""
                style={{ height: "40px", margin: "0 auto" }}
              />
            </Section>
          )}
          <Heading style={{ ...heading, color: brandColor }}>
            Your Case Study Draft
          </Heading>
          <Text style={paragraph}>{body}</Text>
          <Section style={buttonContainer}>
            <Button
              style={{ ...button, backgroundColor: brandColor }}
              href={reviewUrl}
            >
              Review Case Study
            </Button>
          </Section>
          <Text style={snoozeText}>
            Not ready yet?{" "}
            <Link href={snoozeUrl} style={snoozeLink}>
              Snooze for 3 days
            </Link>
          </Text>
          <Text style={footer}>
            This is a friendly reminder. You&apos;ll receive at most 3 of these.
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

const snoozeText = {
  color: "#8898aa",
  fontSize: "13px",
  textAlign: "center" as const,
  margin: "0 0 8px",
};

const snoozeLink = {
  color: "#525f7f",
  textDecoration: "underline",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "20px",
  textAlign: "center" as const,
  marginTop: "24px",
};

export default ReminderEmail;
