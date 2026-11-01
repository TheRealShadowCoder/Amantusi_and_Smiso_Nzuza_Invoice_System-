# Private login deployment

The application now has a server-side Cloudflare Pages Functions login gate in `functions/_middleware.js`.

## Security model

- All application routes and static assets require a signed, short-lived session cookie.
- Login credentials are verified on the server using encrypted Cloudflare environment secrets.
- Cookies are Secure, HttpOnly and SameSite=Strict; logout expires the session.
- No credentials are stored in source control or exposed as JavaScript.
- If secrets are absent, access fails closed with HTTP 503.
- This is **one administrator login**, not a multi-user permission system.
- Browser localStorage is still per-device; access control does not add cross-device syncing.
- Do not host this repository on GitHub Pages or any other static-only site: static hosting cannot run `functions/_middleware.js`, so it would bypass the login layer.
- For production, use Cloudflare Access or add rate limiting to the login endpoint to reduce password-guessing attacks.

## Configuration

1. Deploy this repository as a **Cloudflare Pages project with Functions enabled**.
2. Under Workers & Pages → smiso-amantusi-invoice → Settings → Variables and Secrets, add these as **encrypted Secrets** to production:
   - `INVOICE_LOGIN_EMAIL`: the administrator email address
   - `INVOICE_LOGIN_PASSWORD`: a unique long password
   - `INVOICE_SESSION_SECRET`: independent cryptographically random secret, minimum 32 characters
3. Trigger a fresh production deployment after configuring the secrets.
4. Open the Pages domain; unauthenticated access must redirect to `/__auth/login`.
5. Test that wrong credentials fail, correct credentials open the app, logout expires the session, and a private asset request without a session returns 401.

### Important

The Cloudflare account's current Pages Git integration rejected the repository with HTTP 401, so publishing through GitHub requires reconnecting the GitHub installation or using a supported authenticated Wrangler deployment. Never commit passwords, customer invoices, private backups or the session secret to GitHub.

The repository is public. Its HTML source is public even when the hosted app is protected; any embedded sensitive data or default bank account information should be reviewed.
