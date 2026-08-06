import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrintProvider } from "@/lib/print/provider";

const schema = z.object({
  format: z.enum(["postcard-6x4", "postcard-7x5", "print-8x10"]),
  quantity: z.number().int().min(1).max(500),
  destinationCountry: z.string().length(2).default("US"),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid quote request." }, { status: 400 });
  const quote = await getPrintProvider().quote(parsed.data);
  return NextResponse.json(quote);
}
