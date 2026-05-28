import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "authorization",
      "Authorization",
      "headers.authorization",
      "headers.Authorization",
      "request.headers.authorization",
      "request.headers.Authorization",
      "response.headers.set-cookie",
      "responseHeaders.set-cookie",
      "err.requestBodyValues",
      "err.responseBody",
      "err.responseHeaders",
      "err.data",
      "err.headers",
      "err.config",
      "err.request",
      "err.response",
      "*.accessToken",
      "*.refreshToken",
      "*.botAccessToken",
      "*.token",
      "*.apiKey",
      "*.secret",
      "*.clientSecret",
      "*.encryptedPayload",
      "*.credential",
      "*.credentials",
      "input",
      "metadata.input",
      "afterState.accessToken",
      "afterState.refreshToken",
      "afterState.botAccessToken",
      "beforeState.accessToken",
      "beforeState.refreshToken",
      "beforeState.botAccessToken",
    ],
    censor: "[redacted]",
  },
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
});

export type Logger = typeof logger;
