import { NextResponse } from "next/server";
import { getPrintProvider, isPrintingConfigured } from "@/lib/print/provider";

/**
 * Deliberately refuses unless a real provider is configured — the app never
 * pretends to have mailed something. No payment details are accepted or stored
 * here; a real integration would hand off to a payment processor first.
 */
export async function POST() {
  const provider = getPrintProvider();
  if (!provider.enabled || !isPrintingConfigured()) {
    return NextResponse.json(
      {
        error:
          "Physical mailing is unavailable: this deployment has no print-and-mail provider or payment processor configured.",
        configured: false,
      },
      { status: 501 },
    );
  }
  return NextResponse.json({ error: "Not implemented." }, { status: 501 });
}
