# Deploy TemuSpinBox on Coolify

This deployment uses one container for the Vite frontend, the Express API and the deposit watcher. Express serves the compiled site and API on port 3000. Keep the existing Supabase project and Resend setup when moving the production app. Use a separate Supabase project and test values for staging.

1. Add the Dockerfile and .dockerignore to the repository next to package.json and server/. Push them to the deployment branch.
2. In Coolify, create an application from that Git repository. Select the Dockerfile build pack, set Base Directory to /, Dockerfile Location to /Dockerfile, and Ports Exposes to 3000. If SpinBox is inside a monorepo, set Base Directory to the folder containing these files.
3. Add the HTTPS domain in Coolify and point DNS to the Coolify server. Use the staging domain for the first deployment.
4. Set the variables below. Deploy and check the application logs. Configure the HTTP health check to use GET /api/health on port 3000. A successful health response confirms the process is running. Test email and database operations separately.

| Scope | Variables |
| --- | --- |
| Build | VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_API_BASE_URL |
| Runtime core | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CORS_ORIGIN, RESEND_API_KEY, RESEND_FROM_EMAIL |
| Runtime by feature | APIFY_API_TOKEN, MASTER_WALLET_MNEMONIC, WEBHOOK_SECRET, TRONGRID_API_KEY, SOLANA_RPC_URL, ETHERSCAN_API_KEY, ETHEREUM_RPC_URL, PAYOUT_BTC_ADDRESS, PAYOUT_ETH_ADDRESS, PAYOUT_TRX_ADDRESS, PAYOUT_SOL_ADDRESS |

Set VITE_API_BASE_URL and CORS_ORIGIN to the app's HTTPS origin without a trailing slash. Use the publishable Supabase key in the frontend. Keep server secrets runtime only, enter them in Coolify, and leave them out of the repository. The Dockerfile sets NODE_ENV and PORT and installs Chromium for the existing scraper.

Apply any pending Supabase migrations in timestamp order against staging before testing the matching app version. During the production cutover, run only one instance of the deposit watcher against production. If Render still runs it, stop that instance before starting Coolify against the same production database. The current deposit address derivation needs the original wallet configuration to keep existing addresses usable.

Coolify reference

- https://coolify.io/docs/applications/builds/dockerfile
- https://coolify.io/docs/applications/configuration/environment-variables
