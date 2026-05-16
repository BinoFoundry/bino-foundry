/**
 * PM2 process file — vendor-neutral Node process manager.
 * Usage (from repo root after `npm run build:all`):
 *   pm2 start deploy/pm2/ecosystem.config.cjs --env production
 */
module.exports = {
  apps: [
    {
      name: "bino-foundry-api",
      cwd: "./backend",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
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
