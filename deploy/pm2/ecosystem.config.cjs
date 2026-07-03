/**
 * PM2 process file — vendor-neutral Node process manager.
 * Usage (from repo root after `npm run build:all`):
 *   cd /opt/bino-foundry && pm2 start deploy/pm2/ecosystem.config.cjs --env production
 */
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");

module.exports = {
  apps: [
    {
      name: "bino-foundry-api",
      cwd: path.join(REPO_ROOT, "backend"),
      script: "dist/server.js",
      /** Optional; backend also loads repo-root / deploy/env `.env.production` */
      env_file: path.join(REPO_ROOT, ".env.production"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "768M",
      env_development: {
        APP_ENV: "development",
        NODE_ENV: "development",
      },
      env_staging: {
        APP_ENV: "staging",
        NODE_ENV: "production",
      },
      env_production: {
        APP_ENV: "production",
        NODE_ENV: "production",
      },
    },
  ],
};
