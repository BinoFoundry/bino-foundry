type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const line = meta ? `${message} ${JSON.stringify(meta)}` : message;
  if (level === "error") {
    console.error(`[${level}]`, line);
  } else if (level === "warn") {
    console.warn(`[${level}]`, line);
  } else {
    console.log(`[${level}]`, line);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};
