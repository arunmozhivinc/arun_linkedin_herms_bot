export default () => ({
  port: parseInt(process.env.PORT || "3000", 10),
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  mongoUri: process.env.MONGODB_URI || "",
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  },
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID || "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "",
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/auth/linkedin/callback`,
    apiVersion: "202608",
  },
  falAi: {
    apiKey: process.env.FAL_KEY || "",
  },
});

