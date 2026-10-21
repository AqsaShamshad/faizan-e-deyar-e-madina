import nodemailer from "nodemailer";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendMosqueScreenLink({ to, name, url }: { to: string; name: string; url: string }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) return false;

  const appUrl = process.env.APP_URL;
  if (!appUrl) return false;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(appUrl);
  } catch {
    return false;
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return false;

  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return false;

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });

  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  await transport.sendMail({
    from: SMTP_FROM,
    to,
    subject: `${name} mosque screen link`,
    text: `Your mosque screen is ready. Open this link on the display device:\n\n${url}\n\nKeep this link for your mosque display.`,
    html: `<p>Your mosque screen for ${safeName} is ready.</p><p>Open this link on the display device:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>Keep this link for your mosque display.</p>`,
  });
  return true;
}