import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const createProfileBodySchema = z.object({
  handle: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, "Handle must use lowercase letters, numbers, or hyphens"),
  displayName: z.string().min(1).max(80),
  bio: z.string().max(280).optional(),
  avatarUrl: z.url().optional(),
  isActive: z.boolean().optional().default(true)
});

const createLinkBodySchema = z.object({
  profileId: z.string().min(1),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "Slug must use lowercase letters, numbers, or hyphens"),
  title: z.string().min(1).max(100),
  url: z.url(),
  position: z.number().int().min(1),
  isActive: z.boolean().optional().default(true)
});

const updateLinkBodySchema = z.object({
  title: z.string().min(1).max(100).optional(),
  url: z.url().optional(),
  position: z.number().int().min(1).optional(),
  isActive: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
});

const linkParamsSchema = z.object({
  id: z.string().min(1)
});

const analyticsParamsSchema = z.object({
  slug: z.string().min(2).max(80)
});

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // Protect the entire admin surface with one shared API key pre-handler.
  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", protectedApp.verifyAdmin);

    // Admin listing keeps demos simple and makes it easier to inspect seeded data.
    protectedApp.get("/profiles", async () => {
      return protectedApp.dependencies.prisma.profile.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          links: {
            orderBy: { position: "asc" }
          }
        }
      });
    });

    // Create profiles explicitly so the project demonstrates data validation and persistence.
    protectedApp.post("/profiles", async (request, reply) => {
      const body = createProfileBodySchema.parse(request.body);

      const profile = await protectedApp.dependencies.prisma.profile.create({
        data: body
      });

      return reply.status(201).send(profile);
    });

    // Create links independently because links are the analytics unit we track later.
    protectedApp.post("/links", async (request, reply) => {
      const body = createLinkBodySchema.parse(request.body);

      const link = await protectedApp.dependencies.prisma.link.create({
        data: body
      });

      return reply.status(201).send(link);
    });

    // A focused update route is enough for the MVP while still showing realistic mutating APIs.
    protectedApp.patch("/links/:id", async (request) => {
      const { id } = linkParamsSchema.parse(request.params);
      const body = updateLinkBodySchema.parse(request.body);

      return protectedApp.dependencies.prisma.link.update({
        where: { id },
        data: body
      });
    });

    // This analytics route makes the project easier to demo as a real service, not just CRUD.
    protectedApp.get("/links/:slug/analytics", async (request, reply) => {
      const { slug } = analyticsParamsSchema.parse(request.params);

      const link = await protectedApp.dependencies.prisma.link.findFirst({
        where: { slug },
        select: {
          id: true,
          slug: true,
          title: true,
          profile: {
            select: {
              handle: true
            }
          },
          _count: {
            select: {
              clicks: true
            }
          },
          clicks: {
            orderBy: { clickedAt: "desc" },
            take: 10,
            select: {
              clickedAt: true,
              referrer: true,
              userAgent: true
            }
          }
        }
      });

      if (!link) {
        return reply.status(404).send({
          error: "NotFound",
          message: `Link '${slug}' was not found`
        });
      }

      return {
        slug: link.slug,
        title: link.title,
        profileHandle: link.profile.handle,
        totalClicks: link._count.clicks,
        recentClicks: link.clicks
      };
    });
  }, { prefix: "/admin" });
};
