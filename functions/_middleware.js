/* Server-side access gate for Cloudflare Pages Functions.
   Required encrypted environment secrets: INVOICE_LOGIN_EMAIL, INVOICE_LOGIN_PASSWORD,
   INVOICE_SESSION_SECRET (random 32+ characters).
   ALL asset routes pass through this middleware; no client-side bypass.
*/
const encoder = new TextEncoder();
const COOKIE = "__Host-invoice_session";
const SESSION_SECONDS = 60 * 60 * 8;
const HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const bytesToHex = (bytes) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const hexToBytes = (hex) => {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null;
  return new Uint8Array(hex.match(/../g).map(h => parseInt(h, 16)));
};
async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}
function equalBytes(a,b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff=0;
  for(let i=0;i<a.length;i++) diff |= a[i]^b[i];
  return diff === 0;
}
async function sign(secret, payload) {
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(payload))));
}
function html(body,status=200,headers={}) {
  return new Response(body,{status,headers:{"Content-Type":"text/html; charset=UTF-8",...HEADERS,...headers}});
}
const LOGIN_PAGE = (message="") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Secure Login | Smiso Nzuza & Amantusi</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:radial-gradient(circle at top,#293b58,#081222 65%);color:#fff;padding:20px}
main{width:100%;max-width:420px;background:#111e32;border:1px solid #354860;padding:36px;border-radius:18px;box-shadow:0 28px 90px #0006}
mark{background:transparent;color:#d6b569;font-weight:700;letter-spacing:.13em;text-transform:uppercase;font-size:12px}
h1{font-family:Georgia,serif;font-weight:500;font-size:32px;margin:15px 0 8px}p{color:#b9c7da;line-height:1.5;margin:0 0 24px;font-size:14px}
label{display:block;color:#e5ebf5;font-size:13px;font-weight:600;margin:17px 0 8px}
input{background:#081426;color:#fff;border:1px solid #51617a;border-radius:9px;padding:13px;width:100%;font-size:16px}
input:focus{outline:2px solid #d7b36a}button{width:100%;background:#c8a24d;color:#101828;border:0;border-radius:9px;padding:15px;margin-top:26px;font-size:15px;font-weight:800;cursor:pointer}
.error{padding:12px;background:#55252d;border:1px solid #9d4751;border-radius:9px;color:#fff;margin-top:18px}
footer{margin-top:22px;color:#90a1b7;font-size:12px}
</style></head><body><main><mark>Private business workspace</mark><h1>Invoice system</h1><p>Sign in to manage Smiso Nzuza 90 Trading and Amantusi invoices, quotations and customer records.</p>${message ? '<div class="error" role="alert">'+escapeHtml(message)+'</div>':''}<form method="POST" action="/__auth/login"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="username" required maxlength="254"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="512"><button type="submit">Sign in securely</button></form><footer>Authorised staff only · Secure session expires after 8 hours</footer></main></body></html>`;
function authCookie(request) {
  const cookie=request.headers.get("Cookie")||"";
  const item=cookie.split(";").map(s=>s.trim()).find(s=>s.startsWith(COOKIE+"="));
  return item ? item.slice(COOKIE.length+1) : "";
}
async function authorized(request,env) {
  const value=authCookie(request);
  const split=value.lastIndexOf(".");
  if(split<0)return false;
  const payload=value.slice(0,split),signature=value.slice(split+1);
  const [expiry,emailDigest]=payload.split(":");
  if(!/^\d{10,13}$/.test(expiry) || Number(expiry)<=Date.now() || !/^[0-9a-f]{64}$/.test(emailDigest||""))return false;
  const expectedEmailDigest=bytesToHex(await digest(env.INVOICE_LOGIN_EMAIL.trim().toLowerCase()));
  if(!equalBytes(hexToBytes(emailDigest),hexToBytes(expectedEmailDigest)))return false;
  const expectedSig=await sign(env.INVOICE_SESSION_SECRET,payload);
  return equalBytes(hexToBytes(signature),hexToBytes(expectedSig));
}
export async function onRequest(context) {
  const {request,env}=context;
  const path=new URL(request.url).pathname;
  if(!env.INVOICE_LOGIN_EMAIL || !env.INVOICE_LOGIN_PASSWORD || !env.INVOICE_SESSION_SECRET || env.INVOICE_SESSION_SECRET.length<32) {
    return html("<h1>Invoice login not configured</h1><p>Administrator: set INVOICE_LOGIN_EMAIL, INVOICE_LOGIN_PASSWORD and INVOICE_SESSION_SECRET as encrypted Cloudflare Pages environment secrets.</p>",503);
  }
  if(path==="/__auth/login" && request.method==="POST") {
    const form=await request.formData();
    const email=String(form.get("email")||"").trim().toLowerCase();
    const password=String(form.get("password")||"");
    const emailOk=equalBytes(await digest(email),await digest(env.INVOICE_LOGIN_EMAIL.trim().toLowerCase()));
    const passOk=equalBytes(await digest(password),await digest(env.INVOICE_LOGIN_PASSWORD));
    if(!emailOk || !passOk) return html(LOGIN_PAGE("Incorrect email or password."),401);
    const payload=`${Date.now()+SESSION_SECONDS*1000}:${bytesToHex(await digest(email))}`;
    const token=`${payload}.${await sign(env.INVOICE_SESSION_SECRET,payload)}`;
    return new Response(null,{status:303,headers:{Location:"/",...HEADERS,"Set-Cookie":`${COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`}});
  }
  if(path==="/__auth/logout" && request.method==="POST") {
    const origin=request.headers.get("Origin");
    if(origin && origin!==new URL(request.url).origin)return html("Forbidden",403);
    return new Response(null,{status:303,headers:{Location:"/__auth/login",...HEADERS,"Set-Cookie":`${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`}});
  }
  if(path==="/__auth/login") {
    if(await authorized(request,env))return Response.redirect(new URL("/",request.url),302);
    return html(LOGIN_PAGE());
  }
  if(!(await authorized(request,env))) {
    if(request.method==="GET" && (request.headers.get("Accept")||"").includes("text/html"))
      return Response.redirect(new URL("/__auth/login",request.url),302);
    return html("Authentication required",401);
  }
  const response=await context.next();
  const headers=new Headers(response.headers);
  headers.set("Cache-Control","private, no-store");
  headers.set("X-Content-Type-Options","nosniff");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
