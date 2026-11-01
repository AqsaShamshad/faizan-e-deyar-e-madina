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

export async function sendMosqueAccountDetails({ to, name, adminName, password, url }: { to: string; name: string; adminName: string; password: string; url: string }) {
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
  const safeAdminName = escapeHtml(adminName);
  const safeEmail = escapeHtml(to);
  const safePassword = escapeHtml(password);
  const safeUrl = escapeHtml(url);
  const loginUrl = new URL("/login", parsedUrl).toString();
  const safeLoginUrl = escapeHtml(loginUrl);
  await transport.sendMail({
    from: SMTP_FROM,
    to,
    subject: `${name} mosque screen and account details`,
    text: `Your mosque screen and administrator account for ${name} are ready.\n\nAdministrator: ${adminName}\nLogin page: ${loginUrl}\nEmail: ${to}\nInitial password: ${password}\n\nOpen this link on the display device:\n${url}\n\nKeep this link for your mosque display and share the account details only with the mosque administrator.`,
    html: `<p>Your mosque screen and administrator account for ${safeName} are ready.</p><p><strong>Administrator:</strong> ${safeAdminName}<br><strong>Login page:</strong> <a href="${safeLoginUrl}">${safeLoginUrl}</a><br><strong>Email:</strong> ${safeEmail}<br><strong>Initial password:</strong> ${safePassword}</p><p>Open this link on the display device:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>Keep this link for your mosque display and share the account details only with the mosque administrator.</p>`,
  });
  return true;
}