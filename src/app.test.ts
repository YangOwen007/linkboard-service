import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import type { AppEnv } from "./config/env.js";
import type { PrismaClientLike } from "./types.js";
import { hashIpAddress } from "./lib/security.js";
import { loadEnv } from "./config/env.js";

const testEnv: AppEnv = {
  NODE_ENV: "test",
  PORT: 3000,
  HOST: "127.0.0.1",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  ADMIN_API_KEY: "test-admin-api-key",
  IP_HASH_SALT: "test-ip-hash-salt",
  LOG_LEVEL: "silent"
};

function buildPrismaStub(): PrismaClientLike {
  // Stub only the Prisma methods our tests exercise so we can verify route behavior quickly.
  return {
    profile: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn()
    },
    link: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    clickEvent: {
      create: vi.fn()
    },
    $connect: vi.fn(),
    $queryRaw: vi.fn(),
    $disconnect: vi.fn()
  } as unknown as PrismaClientLike;
}

describe("createApp", () => {
  let prisma: PrismaClientLike;
  const apps: ReturnType<typeof createApp>[] = [];
  const makeApp = () => {
    const app = createApp({ env: testEnv, prisma });
    apps.push(app);
    return app;
  };
  afterEach(async () => {
    // Closing each app releases rate-limit timers and database resources.
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  beforeEach(() => {
    prisma = buildPrismaStub();
  });

  it("returns a healthy response", async () => {
    const app = makeApp();

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      environment: "test"
    });
  });

  it("blocks admin routes without an API key", async () => {
    const app = makeApp();

    const response = await app.inject({
      method: "GET",
      url: "/admin/profiles"
    });

    expect(response.statusCode).toBe(401);
  });

  it("allows admin profile listing with a valid API key", async () => {
    const app = makeApp();
    vi.mocked(prisma.profile.findMany).mockResolvedValue([
      {
        id: "profile_123",
        handle: "owenyang",
        displayName: "Owen Yang",
        bio: "Backend-focused builder",
        avatarUrl: null,
        isActive: true,
        createdAt: new Date("2026-07-27T00:00:00.000Z"),
        updatedAt: new Date("2026-07-27T00:00:00.000Z"),
        links: []
      }
    ] as any);

    const response = await app.inject({
      method: "GET",
      url: "/admin/profiles",
      headers: {
        "x-api-key": testEnv.ADMIN_API_KEY
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([
      expect.objectContaining({
        handle: "owenyang"
      })
    ]);
  });

  it("returns a public profile with active links", async () => {
    const app = makeApp();
    vi.mocked(prisma.profile.findFirst).mockResolvedValue({
      handle: "owenyang",
      displayName: "Owen Yang",
      bio: "Backend-focused builder",
      avatarUrl: null,
      links: [
        {
          slug: "github",
          title: "GitHub",
          url: "https://github.com/example",
          position: 1
        }
      ]
    } as any);

    const response = await app.inject({
      method: "GET",
      url: "/profiles/owenyang"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      handle: "owenyang",
      links: [
        expect.objectContaining({ slug: "github" })
      ]
    });
  });

  it("records click analytics for active links", async () => {
    const app = makeApp();
    vi.mocked(prisma.link.findFirst).mockResolvedValue({ id: "link_123" } as any);

    const response = await app.inject({
      method: "POST",
      url: "/links/github/click",
      headers: {
        referer: "https://portfolio.example",
        "user-agent": "Vitest"
      }
    });

    expect(response.statusCode).toBe(202);
    expect(prisma.clickEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          linkId: "link_123"
        })
      })
    );
  });

  it("accepts form-encoded click tracking requests from simple clients", async () => {
    const app = makeApp();
    vi.mocked(prisma.link.findFirst).mockResolvedValue({ id: "link_456" } as any);

    const response = await app.inject({
      method: "POST",
      url: "/links/github/click",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      payload: ""
    });

    expect(response.statusCode).toBe(202);
    expect(prisma.clickEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          linkId: "link_456"
        })
      })
    );
  });

  it("reports database readiness and unavailable state", async () => {
    const app = makeApp();
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ ready: 1 }]);
    expect((await app.inject("/ready")).statusCode).toBe(200);
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("private connection details"));
    const response = await app.inject("/ready");
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("private");
  });

  it("rejects incorrect keys before parsing or writing admin data", async () => {
    const app = makeApp();
    const response = await app.inject({ method: "POST", url: "/admin/profiles", headers: { "x-api-key": "wrong", "content-type": "application/json" }, payload: "{" });
    expect(response.statusCode).toBe(401);
    expect(prisma.profile.create).not.toHaveBeenCalled();
  });

  it("rejects executable link URLs and empty updates", async () => {
    const app = makeApp();
    for (const url of ["javascript:alert(1)", "file:///etc/passwd", "ftp://example.com"]) {
      const response = await app.inject({ method: "POST", url: "/admin/links", headers: { "x-api-key": testEnv.ADMIN_API_KEY }, payload: { profileId: "p1", slug: "test", title: "Test", url, position: 1 } });
      expect(response.statusCode).toBe(400);
    }
    expect((await app.inject({ method: "PATCH", url: "/admin/links/id", headers: { "x-api-key": testEnv.ADMIN_API_KEY }, payload: {} })).statusCode).toBe(400);
    expect(prisma.link.create).not.toHaveBeenCalled();
  });

  it("maps database failures without disclosing internal details", async () => {
    const app = makeApp();
    for (const [code, status] of [["P2002", 409], ["P2003", 400], ["P2025", 404], ["UNKNOWN", 500]] as const) {
      vi.mocked(prisma.profile.findMany).mockRejectedValueOnce(Object.assign(new Error("private SQL password"), { code }));
      const response = await app.inject({ url: "/admin/profiles", headers: { "x-api-key": testEnv.ADMIN_API_KEY } });
      expect(response.statusCode).toBe(status);
      expect(response.body).not.toContain("private SQL");
    }
  });

  it("ignores spoofed proxy IPs and strips private referrer data", async () => {
    const app = makeApp();
    vi.mocked(prisma.link.findFirst).mockResolvedValue({ id: "link_123" } as any);
    await app.inject({ method: "POST", url: "/links/github/click", remoteAddress: "192.0.2.10", headers: { "x-forwarded-for": "203.0.113.42", referer: "https://user:pass@example.com/private?token=secret", "user-agent": "a".repeat(1000) } });
    expect(prisma.clickEvent.create).toHaveBeenCalledWith({ data: { linkId: "link_123", referrer: "https://example.com", userAgent: "a".repeat(256), ipHash: hashIpAddress("192.0.2.10", testEnv.IP_HASH_SALT) } });
  });

  it("limits writes even when forwarded addresses change", async () => {
    const app = makeApp();
    vi.mocked(prisma.link.findFirst).mockResolvedValue(null);
    for (let index = 0; index < 120; index++) {
      expect((await app.inject({ method: "POST", url: "/links/missing/click", headers: { "x-forwarded-for": `192.0.2.${index}` } })).statusCode).toBe(404);
    }
    const response = await app.inject({ method: "POST", url: "/links/missing/click" });
    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBeDefined();
    expect((await app.inject("/health")).statusCode).toBe(200);
  });

  it("rejects placeholder production secrets without echoing configuration", () => {
    expect(() => loadEnv({ ...testEnv, PORT: "3000", NODE_ENV: "production", ADMIN_API_KEY: "replace-with-a-long-random-string" })).toThrow("Production");
    expect(() => loadEnv({ DATABASE_URL: "sensitive", ADMIN_API_KEY: "private" })).toThrow("Invalid environment configuration");
  });
  it("rejects oversized request bodies before database writes", async () => {
    const app = makeApp();
    const response = await app.inject({ method: "POST", url: "/admin/profiles", headers: { "x-api-key": testEnv.ADMIN_API_KEY }, payload: { handle: "test", displayName: "a".repeat(17000) } });
    expect(response.statusCode).toBe(413);
    expect(prisma.profile.create).not.toHaveBeenCalled();
  });
});
