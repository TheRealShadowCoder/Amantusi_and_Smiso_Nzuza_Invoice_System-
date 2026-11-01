/* Server-side access gate for Cloudflare Pages Functions.
   Required encrypted environment secrets: INVOICE_LOGIN_EMAIL, INVOICE_LOGIN_PASSWORD,
   INVOICE_SESSION_SECRET (random 32+ characters).
   ALL asset routes pass through this middleware; no client-side bypass.
*/
const encoder = new TextEncoder();
const COOKIE = "__Host-invoice_session";
const SESSION_SECONDS = 60 * 60 * 8;
const ADMIN_EMAIL = "s.k.businessline@gmail.com";
const normalizeEmail = s => String(s||"").trim().toLowerCase();
async function hashPassword(password,salt) {
  const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:hexToBytes(salt),iterations:210000,hash:"SHA-256"},key,256);
  return bytesToHex(new Uint8Array(bits));
}
async function getUser(env,email) {
  return env.INVOICE_AUTH_DB.prepare("SELECT email, password_hash, salt FROM approved_users WHERE email=? AND active=1").bind(email).first();
}
function json(data,status=200) { return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json",...HEADERS}}); }
const SETTINGS_PAGE=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access Settings | Invoice System</title><style>
body{font:15px system-ui;background:#0f192b;color:#eaf0f8;margin:0;padding:20px}main{max-width:700px;margin:25px auto}h1{color:#e0be75}a{color:#e0be75}section{background:#19253a;border:1px solid #364965;border-radius:14px;padding:24px;margin:22px 0}input,button{font:inherit;border-radius:7px;padding:12px;margin:5px;background:#0b1425;color:#fff;border:1px solid #7184a0}button{cursor:pointer;background:#bd994a;color:#111a2c;font-weight:700}button.danger{background:#953b44;color:white}input{width:min(90%,390px)}li{padding:9px;border-bottom:1px solid #34465e;display:flex;justify-content:space-between;align-items:center;gap:12px}small{color:#9caec7}#msg{min-height:20px}
</style></head><body><main><a href="/">← Back to Invoice System</a><h1>Settings · Access management</h1><p>Administrator: ${ADMIN_EMAIL}</p><section><h2>Approved accounts</h2><ul id="users"></ul></section><section><h2>Add approved email</h2><p><small>Set a unique temporary password for this person and send it privately. Their email alone cannot grant access.</small></p><form id="add"><input id="email" type="email" placeholder="staff@example.com" required maxlength="254"><input id="password" type="password" placeholder="Temporary password (min 12 characters)" required minlength="12"><button>Add user</button></form><p id="msg" role="status"></p></section><form method="POST" action="/__auth/logout"><button class="danger">Sign out</button></form></main><script>
async function req(method,body){let r=await fetch("/__auth/users",{method,credentials:"same-origin",headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});let d=await r.json();if(!r.ok)throw Error(d.error||"Request failed");return d}
async function refresh(){let d=await req("GET");const ul=document.querySelector("#users");ul.replaceChildren();for(let u of d.users){let li=document.createElement("li"),t=document.createElement("span");t.textContent=u.email+(u.admin?" (administrator)":"");li.append(t);if(!u.admin){let b=document.createElement("button");b.className="danger";b.textContent="Revoke";b.onclick=async()=>{if(!confirm("Revoke "+u.email+"?"))return;try{await req("DELETE",{email:u.email});await refresh()}catch(e){document.querySelector("#msg").textContent=e.message}};li.append(b)}ul.append(li)}}
document.querySelector("#add").onsubmit=async e=>{e.preventDefault();const msg=document.querySelector("#msg");try{await req("POST",{email:document.querySelector("#email").value,password:document.querySelector("#password").value});msg.textContent="Account approved. Share the temporary password privately.";e.target.reset();await refresh()}catch(err){msg.textContent=err.message}};
refresh().catch(e=>document.querySelector("#msg").textContent=e.message);
</script></body></html>`;
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
  const adminDigest=bytesToHex(await digest(ADMIN_EMAIL));
  if(!equalBytes(hexToBytes(emailDigest),hexToBytes(adminDigest))) {
    if(!env.INVOICE_AUTH_DB) return false;
    const user=await env.INVOICE_AUTH_DB.prepare("SELECT email FROM approved_users WHERE active=1").all();
    let valid=false;
    for(const row of (user.results||[])) {
      const hashed=bytesToHex(await digest(row.email));
      valid=valid || equalBytes(hexToBytes(emailDigest),hexToBytes(hashed));
    }
    if(!valid)return false;
  }
  const expectedSig=await sign(env.INVOICE_SESSION_SECRET,payload);
  return equalBytes(hexToBytes(signature),hexToBytes(expectedSig));
}
export async function onRequest(context) {
  const {request,env}=context;
  const path=new URL(request.url).pathname;
  if(!env.INVOICE_LOGIN_PASSWORD || !env.INVOICE_SESSION_SECRET || env.INVOICE_SESSION_SECRET.length<32 || !env.INVOICE_AUTH_DB) {
    return html("<h1>Invoice login not configured</h1><p>Administrator: set INVOICE_LOGIN_PASSWORD, INVOICE_SESSION_SECRET and INVOICE_AUTH_DB as encrypted Cloudflare Pages environment secrets.</p>",503);
  }
  if(path==="/__auth/login" && request.method==="POST") {
    const form=await request.formData();
    const email=normalizeEmail(form.get("email"));
    const password=String(form.get("password")||"");
    const admin=email===ADMIN_EMAIL;
    const user=admin?null:await getUser(env,email);
    const emailOk=admin||!!user;
    const passOk=admin ? equalBytes(await digest(password),await digest(env.INVOICE_LOGIN_PASSWORD)) : (user ? equalBytes(hexToBytes(await hashPassword(password,user.salt)),hexToBytes(user.password_hash)) : false);
    if(!emailOk || !passOk) return html(LOGIN_PAGE("Incorrect email or password."),401);
    const payload=`${Date.now()+SESSION_SECONDS*1000}:${bytesToHex(await digest(email))}`;
    const token=`${payload}.${await sign(env.INVOICE_SESSION_SECRET,payload)}`;
    return new Response(null,{status:303,headers:{Location:"/",...HEADERS,"Set-Cookie":`${COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`}});
  }
  if(path==="/__auth/settings" || path==="/__auth/users") {
    if(!await authorized(request,env))return json({error:"Authentication required"},401);
    const adminCookie=authCookie(request);
    const payload=adminCookie.slice(0,adminCookie.lastIndexOf("."));
    if(!payload.endsWith(":"+bytesToHex(await digest(ADMIN_EMAIL))))return json({error:"Administrator only"},403);
    if(path==="/__auth/settings")return html(SETTINGS_PAGE);
    if(request.method==="GET") {
      const result=await env.INVOICE_AUTH_DB.prepare("SELECT email FROM approved_users WHERE active=1 ORDER BY email").all();
      return json({users:[{email:ADMIN_EMAIL,admin:true},...(result.results||[]).map(x=>({email:x.email,admin:false}))]});
    }
    const origin=request.headers.get("Origin");
    if(origin !== new URL(request.url).origin)return json({error:"Invalid request origin"},403);
    const body=await request.json().catch(()=>({}));
    const email=normalizeEmail(body.email);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||email===ADMIN_EMAIL)return json({error:"Invalid email"},400);
    if(request.method==="POST") {
      if(typeof body.password!=="string"||body.password.length<12||body.password.length>256)return json({error:"Password must be 12-256 characters"},400);
      const salt=bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
      const hash=await hashPassword(body.password,salt);
      await env.INVOICE_AUTH_DB.prepare("INSERT INTO approved_users(email,password_hash,salt,active) VALUES(?,?,?,1) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,salt=excluded.salt,active=1").bind(email,hash,salt).run();
      return json({success:true});
    }
    if(request.method==="DELETE") {
      await env.INVOICE_AUTH_DB.prepare("UPDATE approved_users SET active=0 WHERE email=?").bind(email).run();
      return json({success:true});
    }
    return json({error:"Method not allowed"},405);
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
  if((response.headers.get("content-type")||"").includes("text/html") && path==="/") {
    const raw=await response.text();
    const nav='<a href="/__auth/settings" style="position:fixed;right:14px;bottom:14px;z-index:99999;background:#b89948;color:#091526;padding:12px 18px;border-radius:999px;font:700 14px system-ui;box-shadow:0 5px 22px #0007;text-decoration:none">⚙ Settings · Access</a>';
    return html(raw.replace(/<\/body>/i,nav+'</body>'));
  }
  const headers=new Headers(response.headers);
  headers.set("Cache-Control","private, no-store");
  headers.set("X-Content-Type-Options","nosniff");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
