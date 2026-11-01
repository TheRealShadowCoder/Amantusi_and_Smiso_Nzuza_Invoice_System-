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
   - Primary administrator email is fixed in the server: `s.k.businessline@gmail.com`
   - `INVOICE_LOGIN_PASSWORD`: a unique long password
   - `INVOICE_SESSION_SECRET`: independent cryptographically random secret, minimum 32 characters
3. Trigger a fresh production deployment after configuring the secrets.
4. Open the Pages domain; unauthenticated access must redirect to `/__auth/login`.
5. Test that wrong credentials fail, correct credentials open the app, logout expires the session, and a private asset request without a session returns 401.

### Important

The Cloudflare account's current Pages Git integration rejected the repository with HTTP 401, so publishing through GitHub requires reconnecting the GitHub installation or using a supported authenticated Wrangler deployment. Never commit passwords, customer invoices, private backups or the session secret to GitHub.

The repository is public. Its HTML source is public even when the hosted app is protected; any embedded sensitive data or default bank account information should be reviewed.

## Approved email management

The primary administrator is **s.k.businessline@gmail.com**. The administrator signs in with that email and the `INVOICE_LOGIN_PASSWORD` secret.

A Cloudflare D1 database `smiso_amantusi_auth` has been created with an `approved_users` table and connected to production/preview using binding `INVOICE_AUTH_DB`. Do not commit passwords into the repository.

Within the signed-in application, choose **Settings · Access** (bottom right). The owner-only page allows:
- Listing approved accounts
- Approving another email with a unique password (at least 12 characters)
- Revoking approved emails (revocation takes effect on the next server request)

Passwords for other users are salted and derived using PBKDF2-SHA256 with 210,000 rounds. The D1 database persists approvals across devices and deployment rebuilds. This **does not** synchronize the invoice/CRM records themselves; browser localStorage remains local. Approved addresses are not proof of mailbox ownership: the owner must safely communicate the temporary password and independently verify the recipient. No automatic email invitations are sent.

**Still needed before launch**: set unique high-entropy secrets `INVOICE_LOGIN_PASSWORD` and `INVOICE_SESSION_SECRET` as encrypted Cloudflare Pages project secrets, repair Git integration or deploy through Wrangler, verify the login and all protected routes. Consider Cloudflare WAF login rate limits before production. The legacy service worker can cache pages for offline use, so do not rely on server authentication to revoke already-cached offline assets; review PWA cache policy before using sensitive customer data.
