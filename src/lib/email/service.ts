/**
 * Email abstraction.
 *
 * Nothing in the app talks to a provider directly. When RESEND_API_KEY is set,
 * the API route uses Resend; otherwise the console transport records the
 * message and the UI tells the user email isn't configured rather than
 * pretending a send succeeded.
 */

export interface ShareEmail {
  to: string[];
  fromName: string;
  subject: string;
  message: string;
  sheetTitle: string;
  url: string;
  attachmentUrl?: string;
}

export interface EmailResult {
  delivered: boolean;
  provider: "resend" | "console";
  detail: string;
}

export interface EmailService {
  send(email: ShareEmail): Promise<EmailResult>;
}

export function renderShareEmail(email: ShareEmail): { html: string; text: string } {
  const safe = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
  const text = [
    `${email.fromName} shared a contact sheet with you: ${email.sheetTitle}`,
    "",
    email.message,
    "",
    email.url,
    email.attachmentUrl ? `Download: ${email.attachmentUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;background:#0a0a0b;color:#efece5;padding:32px">
  <p style="font:11px Helvetica Neue,Helvetica,Arial,sans-serif;letter-spacing:.2em;color:#8b8780;margin:0 0 18px">CONTACT SHEET</p>
  <h1 style="font-size:24px;font-weight:500;margin:0 0 8px">${safe(email.sheetTitle)}</h1>
  <p style="color:#d8d3c9;margin:0 0 20px">${safe(email.fromName)} shared this with you.</p>
  ${email.message ? `<p style="color:#d8d3c9;white-space:pre-wrap;border-left:2px solid #d81f26;padding-left:12px">${safe(email.message)}</p>` : ""}
  <p style="margin:24px 0"><a href="${email.url}" style="background:#efece5;color:#0a0a0b;padding:12px 20px;text-decoration:none;font-weight:500">View the contact sheet</a></p>
  ${email.attachmentUrl ? `<p><a href="${email.attachmentUrl}" style="color:#f2c218">Download the export</a></p>` : ""}
</div>`;

  return { html, text };
}

class ConsoleEmailService implements EmailService {
  async send(email: ShareEmail): Promise<EmailResult> {
    const { text } = renderShareEmail(email);
    console.info("[email:console]", email.to.join(", "), "\n", text);
    return {
      delivered: false,
      provider: "console",
      detail: "Email isn’t configured on this deployment — set RESEND_API_KEY to send for real.",
    };
  }
}

class ResendEmailService implements EmailService {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send(email: ShareEmail): Promise<EmailResult> {
    const { html, text } = renderShareEmail(email);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: email.to,
        subject: email.subject,
        html,
        text,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend rejected the message: ${detail.slice(0, 200)}`);
    }
    return { delivered: true, provider: "resend", detail: "Sent." };
  }
}

export function getEmailService(): EmailService {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (key && from) return new ResendEmailService(key, from);
  return new ConsoleEmailService();
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
