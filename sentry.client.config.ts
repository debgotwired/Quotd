import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://cba26edb8cf6fefa975ac3c1813ea850@o4511075381018624.ingest.us.sentry.io/4511075395895296",

  // Performance monitoring
  tracesSampleRate: 1.0,

  // Session replay for debugging user issues
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of error sessions

  integrations: [
    Sentry.replayIntegration(),
  ],

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",
});
