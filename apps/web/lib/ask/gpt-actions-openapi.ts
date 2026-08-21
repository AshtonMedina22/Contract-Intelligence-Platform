/**
 * OpenAPI 3.1 schema for ChatGPT Custom GPT Actions.
 * Import in ChatGPT → Create GPT → Actions → schema.
 * Auth: Bearer GPT_ACTIONS_SECRET (API Key auth in GPT builder).
 *
 * Replace SERVER_URL with your Vercel URL, e.g. https://your-app.vercel.app
 */
export const GPT_ACTIONS_OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "L&P Contract Intelligence Actions",
    version: "1.0.0",
    description:
      "Call the Contract Intelligence Platform tools from ChatGPT Pro. Internal verified evidence and optional public research. Never invent L&P rates.",
  },
  servers: [{ url: "SERVER_URL" }],
  paths: {
    "/api/ask/actions/search-historical-evidence": {
      post: {
        operationId: "searchHistoricalEvidence",
        summary: "Search HUMAN_VERIFIED historical passages",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: { type: "string" },
                  limit: { type: "integer" },
                  purpose: { type: "string" },
                  opportunityId: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Evidence bag" } },
      },
    },
    "/api/ask/actions/get-pricing-history": {
      post: {
        operationId: "getPricingHistory",
        summary: "Four-truth pricing lines (proposed/awarded/current/requested separate)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  query: { type: "string" },
                  limit: { type: "integer" },
                  purpose: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Pricing evidence" } },
      },
    },
    "/api/ask/actions/get-contract-terms": {
      post: {
        operationId: "getContractTerms",
        summary: "List contracts under org RLS",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { query: { type: "string" }, limit: { type: "integer" } },
              },
            },
          },
        },
        responses: { "200": { description: "Contracts" } },
      },
    },
    "/api/ask/actions/get-win-loss-history": {
      post: {
        operationId: "getWinLossHistory",
        summary: "Observed awards / win-loss structured rows",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { limit: { type: "integer" } } },
            },
          },
        },
        responses: { "200": { description: "Awards" } },
      },
    },
    "/api/ask/actions/get-buyer-history": {
      post: {
        operationId: "getBuyerHistory",
        summary: "Locate buyers/opportunities/contracts by name (structured)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: { query: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Locate records" } },
      },
    },
    "/api/ask/actions/search-public-research": {
      post: {
        operationId: "searchPublicResearch",
        summary: "Public web/procurement research (not verified corpus)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: { query: { type: "string" }, limit: { type: "integer" } },
              },
            },
          },
        },
        responses: { "200": { description: "Public evidence" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
  security: [{ bearerAuth: [] }],
} as const;
