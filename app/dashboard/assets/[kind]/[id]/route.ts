import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: RouteContext<"/dashboard/assets/[kind]/[id]">) {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (session?.user?.role !== "MOSQUE_ADMIN" || !tenantId) return new Response("Unauthorized", { status: 401 });

  const { kind, id } = await context.params;
  if (!z.enum(["slide", "logo", "ringtone"]).safeParse(kind).success || !z.cuid().safeParse(id).success) {
    return new Response("Not found", { status: 404 });
  }

  const asset = kind === "ringtone"
    ? await prisma.ringtone.findFirst({ where: { id, tenantId }, select: { audio: true, contentType: true } })
    : kind === "slide"
      ? await prisma.slide.findFirst({ where: { id, tenantId }, select: { image: true, contentType: true } })
      : await prisma.logo.findFirst({ where: { id, tenantId }, select: { image: true, contentType: true } });
  if (!asset) return new Response("Not found", { status: 404 });

  const body = "audio" in asset ? asset.audio : asset.image;
  return new Response(body, {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}