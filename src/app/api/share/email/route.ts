import { NextResponse } from "next/server";
import { z } from "zod";
import { getEmailService, isEmailConfigured } from "@/lib/email/service";

const schema = z.object({
  to: z.array(z.email()).min(1).max(20),
  message: z.string().max(2000).default(""),
  sheetTitle: z.string().min(1).max(200),
  url: z.string().min(1).max(500),
  fromName: z.string().max(120).default("A photographer"),
  attachmentUrl: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the email addresses and try again." }, { status: 400 });
  }

  const service = getEmailService();
  try {
    const result = await service.send({
      to: parsed.data.to,
      fromName: parsed.data.fromName,
      subject: `${parsed.data.fromName} shared a contact sheet: ${parsed.data.sheetTitle}`,
      message: parsed.data.message,
      sheetTitle: parsed.data.sheetTitle,
      url: parsed.data.url,
      attachmentUrl: parsed.data.attachmentUrl,
    });
    return NextResponse.json(result, { status: result.delivered ? 200 : 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not send the email.",
        configured: isEmailConfigured(),
      },
      { status: 502 },
    );
  }
}
