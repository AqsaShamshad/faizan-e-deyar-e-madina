import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: RouteContext<"/dashboard/assets/[kind]/[id]">) {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (session?.user?.role !== "MOSQUE_ADMIN" || !tenantId) return new Response("Unauthorized", { status: 401 });

  const { kind, id } = await context.params;
  if (!z.enum(["slide", "logo"]).safeParse(kind).success || !z.cuid().safeParse(id).success) {
    return new Response("Not found", { status: 404 });
  }

  const asset = kind === "slide"
    ? await prisma.slide.findFirst({ where: { id, tenantId }, select: { image: true, contentType: true } })
    : await prisma.logo.findFirst({ where: { id, tenantId }, select: { image: true, contentType: true } });
  if (!asset) return new Response("Not found", { status: 404 });

  return new Response(asset.image, {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.image.byteLength),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}