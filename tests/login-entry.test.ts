import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../src/app/page";

const forbiddenPublicTerms = /bj[öo]rnson|bytov[ýy]\s+dom|hlasovan|vlastníkov/i;

test("public home renders only the neutral server-side login form", async () => {
  const element = await Home({ searchParams: Promise.resolve({}) });
  const html = renderToStaticMarkup(element);

  assert.match(html, /<h1[^>]*>Prihlásenie<\/h1>/);
  assert.match(html, /<form[^>]+action="\/api\/auth\/login"[^>]+method="post"/);
  assert.match(html, /<input(?=[^>]*name="email")(?=[^>]*type="email")[^>]*>/);
  assert.match(html, /<input(?=[^>]*name="password")(?=[^>]*type="password")[^>]*>/);
  assert.match(html, /<button[^>]+type="submit"[^>]*>Prihlásiť<\/button>/);
  assert.doesNotMatch(html, forbiddenPublicTerms);
});

test("failed login feedback stays generic", async () => {
  const element = await Home({ searchParams: Promise.resolve({ error: "invalid" }) });
  const html = renderToStaticMarkup(element);

  assert.match(html, /Nesprávny e-mail alebo heslo/);
  assert.doesNotMatch(html, forbiddenPublicTerms);
});

test("public metadata, styles, and icon do not disclose the application purpose", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const page = readFileSync("src/app/page.tsx", "utf8");
  const styles = readFileSync("src/app/login.css", "utf8");
  const legacyLogin = readFileSync("src/app/admin/login/page.tsx", "utf8");
  const publicSource = [layout, page, styles, legacyLogin].join("\n");

  assert.match(layout, /title:\s*"Prihlásenie"/);
  assert.match(layout, /index:\s*false/);
  assert.match(layout, /follow:\s*false/);
  assert.match(layout, /import "\.\/login\.css"/);
  assert.doesNotMatch(layout, /globals\.css/);
  assert.doesNotMatch(publicSource, forbiddenPublicTerms);
  assert.equal(existsSync("src/app/icon.png"), false);
  assert.equal(existsSync("src/app/icon.svg"), true);
});

test("internal styles load only inside authenticated and token routes", () => {
  const adminLayout = readFileSync("src/app/admin/(dashboard)/layout.tsx", "utf8");
  const tokenLayout = readFileSync("src/app/hlasuj/[token]/layout.tsx", "utf8");

  assert.match(adminLayout, /import "\.\.\/\.\.\/globals\.css"/);
  assert.match(tokenLayout, /import "\.\.\/\.\.\/globals\.css"/);
});

test("the login endpoint accepts form submissions and returns browser redirects", () => {
  const route = readFileSync("src/app/api/auth/login/route.ts", "utf8");

  assert.match(route, /request\.formData\(\)/);
  assert.match(route, /NextResponse\.redirect\(new URL\("\/admin", request\.url\), 303\)/);
  assert.match(route, /sec-fetch-site/);
});
