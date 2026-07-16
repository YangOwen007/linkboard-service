-- Create the public profiles shown on a user's linkboard.
CREATE TABLE "Profile" (
  "id" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "bio" TEXT,
  "avatarUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- Create the individual links that belong to each profile.
CREATE TABLE "Link" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- Store each click event as its own row so analytics can evolve over time.
CREATE TABLE "ClickEvent" (
  "id" TEXT NOT NULL,
  "linkId" TEXT NOT NULL,
  "referrer" TEXT,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClickEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Profile_handle_key" ON "Profile"("handle");
CREATE UNIQUE INDEX "Link_slug_key" ON "Link"("slug");
CREATE INDEX "Link_profileId_position_idx" ON "Link"("profileId", "position");
CREATE INDEX "ClickEvent_linkId_clickedAt_idx" ON "ClickEvent"("linkId", "clickedAt");

ALTER TABLE "Link"
ADD CONSTRAINT "Link_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClickEvent"
ADD CONSTRAINT "ClickEvent_linkId_fkey"
FOREIGN KEY ("linkId") REFERENCES "Link"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
