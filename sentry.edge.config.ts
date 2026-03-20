import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://cba26edb8cf6fefa975ac3c1813ea850@o4511075381018624.ingest.us.sentry.io/4511075395895296",

  tracesSampleRate: 1.0,

  enabled: process.env.NODE_ENV === "production",
});
