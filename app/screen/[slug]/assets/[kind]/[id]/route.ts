import { getPublicRingtoneAsset, getPublicScreenAsset } from "@/lib/public-screen";

export async function GET(_request: Request, context: { params: Promise<{ slug: string; kind: string; id: string }> }) {
  const { slug, kind, id } = await context.params;
  if (kind === "ringtone") {
    const asset = await getPublicRingtoneAsset(slug, id);
    if (!asset) return new Response("Not found", { status: 404 });
    return new Response(asset.audio, {
      headers: {
        "Content-Type": asset.contentType,
        "Content-Length": String(asset.audio.byteLength),
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (kind !== "slide" && kind !== "logo") return new Response("Not found", { status: 404 });
  const asset = await getPublicScreenAsset(slug, kind, id);
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(asset.image, {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.image.byteLength),
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}