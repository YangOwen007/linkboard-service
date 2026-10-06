import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { hashIpAddress } from "../lib/security.js";

function referrerOrigin(value: string | undefined) {
  // Drop paths, queries and credentials; referrer URLs can contain private tokens.
  try {
    const url = new URL(value ?? "");
    return ["http:", "https:"].includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}

const profileParamsSchema = z.object({
  handle: z.string().min(2).max(40)
});

const clickParamsSchema = z.object({
  slug: z.string().min(2).max(80)
});

export const profileRoutes: FastifyPluginAsync = async (app) => {
  // Return one public profile view with only active links exposed to the world.
  app.get("/profiles/:handle", async (request, reply) => {
    const { handle } = profileParamsSchema.parse(request.params);

    const profile = await app.dependencies.prisma.profile.findFirst({
      where: {
        handle,
        isActive: true
      },
      select: {
        handle: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        links: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          select: {
            slug: true,
            title: true,
            url: true,
            position: true
          }
        }
      }
    });

    if (!profile) {
      return reply.status(404).send({
        error: "NotFound",
        message: `Profile '${handle}' was not found`
      });
    }

    return profile;
  });

  // Record a click event separately so analytics writes stay explicit and easy to discuss.
  app.post("/links/:slug/click", async (request, reply) => {
    const { slug } = clickParamsSchema.parse(request.params);

    const link = await app.dependencies.prisma.link.findFirst({
      where: {
        slug,
        isActive: true,
        profile: { isActive: true }
      },
      select: { id: true }
    });

    if (!link) {
      return reply.status(404).send({
        error: "NotFound",
        message: `Link '${slug}' was not found`
      });
    }

    await app.dependencies.prisma.clickEvent.create({
      data: {
        linkId: link.id,
        referrer: referrerOrigin(request.headers.referer),
        userAgent: request.headers["user-agent"]?.slice(0, 256) ?? null,
        ipHash: hashIpAddress(request.ip, app.dependencies.env.IP_HASH_SALT) ?? null
      }
    });

    return reply.status(202).send({ recorded: true });
  });
};
