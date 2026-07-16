import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import type { AppEnv } from "./config/env.js";
import type { PrismaClientLike } from "./types.js";

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
    $disconnect: vi.fn()
  } as unknown as PrismaClientLike;
}

describe("createApp", () => {
  let prisma: PrismaClientLike;

  beforeEach(() => {
    prisma = buildPrismaStub();
  });

  it("returns a healthy response", async () => {
    const app = createApp({ env: testEnv, prisma });

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
    const app = createApp({ env: testEnv, prisma });

    const response = await app.inject({
      method: "GET",
      url: "/admin/profiles"
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns a public profile with active links", async () => {
    const app = createApp({ env: testEnv, prisma });
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
    });

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
    const app = createApp({ env: testEnv, prisma });
    vi.mocked(prisma.link.findFirst).mockResolvedValue({ id: "link_123" });

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
});
