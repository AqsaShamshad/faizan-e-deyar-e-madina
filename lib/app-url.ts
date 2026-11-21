import { headers } from "next/headers";

function getHttpOrigin(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export async function getAppOrigin() {
  const configuredOrigin = process.env.APP_URL?.trim();
  if (configuredOrigin) {
    const origin = getHttpOrigin(configuredOrigin);
    if (!origin) {
      throw new Error("APP_URL must be an absolute HTTP or HTTPS origin.");
    }
    return origin;
  }

  const requestHeaders = await headers();
  const requestOrigin = getHttpOrigin(requestHeaders.get("origin"));
  if (requestOrigin) return requestOrigin;

  const forwardedHost = requestHeaders
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost || requestHeaders.get("host");
  if (!host) throw new Error("Could not determine the application URL.");

  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol =
    forwardedProtocol || (process.env.NODE_ENV === "production" ? "https" : "http");
  const origin = getHttpOrigin(`${protocol}://${host}`);
  if (!origin) throw new Error("Could not determine the application URL.");
  return origin;
}
