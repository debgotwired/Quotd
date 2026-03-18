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

interface TeamInviteEmailProps {
  teamName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}

export function TeamInviteEmail({
  teamName,
  inviterName,
  role,
  inviteUrl,
}: TeamInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to join {teamName} on Quotd
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>You&apos;re Invited</Heading>
          <Text style={paragraph}>
            <strong>{inviterName}</strong> has invited you to join{" "}
            <strong>{teamName}</strong> on Quotd as {role === "editor" ? "an" : "a"}{" "}
            <strong>{role}</strong>.
          </Text>
          <Text style={paragraph}>
            As a team member, you&apos;ll be able to view and collaborate on case
            study interviews shared with the team.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={inviteUrl}>
              Accept Invite
            </Button>
          </Section>
          <Text style={footer}>
            This invite will expire in 7 days. If you don&apos;t have a Quotd
            account, you&apos;ll be prompted to create one first.
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

export default TeamInviteEmail;
