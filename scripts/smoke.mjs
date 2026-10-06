import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createApp } from "../dist/src/app.js";
import { PrismaClient } from "@prisma/client";

// Run against a disposable database: create our own records and remove only those.
if (process.env.ALLOW_INTEGRATION_WRITES !== "true") throw new Error("Set ALLOW_INTEGRATION_WRITES=true only for a disposable test database");
const prisma = new PrismaClient();
const suffix = `${Date.now()}`;
const app = createApp();
const key = app.dependencies.env.ADMIN_API_KEY;
let profileId;
try {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const request = async (path, method = "GET", body, authenticated = true) => fetch(base + path, {
    method, headers: { ...(authenticated ? { "x-api-key": key } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  assert.equal((await request("/ready")).status, 200);
  assert.equal((await request("/admin/profiles", "GET", undefined, false)).status, 401);
  const profile = { handle: `smoke-${suffix}`, displayName: "Integration test" };
  const created = await request("/admin/profiles", "POST", profile);
  assert.equal(created.status, 201);
  profileId = (await created.json()).id;
  assert.equal((await request("/admin/profiles", "POST", profile)).status, 409);
  const slug = `smoke-${suffix}`;
  const link = await request("/admin/links", "POST", { profileId, slug, title: "Test", url: "https://example.com", position: 1 });
  assert.equal(link.status, 201);
  const linkId = (await link.json()).id;
  assert.equal((await request(`/profiles/${profile.handle}`)).status, 200);
  assert.equal((await request(`/links/${slug}/click`, "POST", undefined, false)).status, 202);
  assert.equal((await (await request(`/admin/links/${slug}/analytics`)).json()).totalClicks, 1);
  assert.equal((await request(`/admin/links/${linkId}`, "PATCH", { isActive: false })).status, 200);
  assert.equal((await request(`/links/${slug}/click`, "POST", undefined, false)).status, 404);
  assert.equal((await request("/admin/links/missing", "PATCH", { title: "Missing" })).status, 404);
  console.log("Database smoke passed: readiness, auth, create, duplicate, read, click, analytics, deactivate, missing update.");
} finally {
  try {
    if (profileId) await prisma.profile.delete({ where: { id: profileId } });
  } finally {
    // Release connections even if cleanup fails so CI cannot hang on open handles.
    await Promise.all([app.close(), prisma.$disconnect()]);
  }
}

// Verify the actual compiled entry point starts and drains on SIGTERM (Linux CI).
if (process.platform !== "win32") {
  const child = spawn(process.execPath, ["dist/src/server.js"], { env: { ...process.env, PORT: "3199" }, stdio: "ignore" });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { ready = (await fetch("http://127.0.0.1:3199/ready")).ok; } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, "compiled server did not start");
    const exit = new Promise((resolve) => child.once("exit", (code) => resolve(code)));
    child.kill("SIGTERM");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 30000);
    try { assert.equal(await exit, 0); } finally { clearTimeout(timeout); }
    console.log("Compiled entry point and graceful SIGTERM passed.");
  } finally { if (child.exitCode === null) child.kill("SIGKILL"); }
}
