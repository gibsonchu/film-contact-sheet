/**
 * Print-and-mail provider abstraction.
 *
 * No fake mailing service is shipped. The app builds the postcard, previews
 * both sides and collects the address, then stops at an explicitly disabled
 * checkout unless a real provider and payment processor are configured.
 * Implementing `PrintProvider` against Lob / Gelato / Prodigi / Printful is the
 * only work needed to turn it on.
 */

export type PrintFormat = "postcard-6x4" | "postcard-7x5" | "print-8x10";

export interface MailingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface PrintQuoteRequest {
  format: PrintFormat;
  quantity: number;
  destinationCountry: string;
}

export interface PrintQuote {
  currency: string;
  printCents: number;
  postageCents: number;
  totalCents: number;
  estimatedDeliveryDays: [number, number];
}

export interface PrintOrderRequest {
  format: PrintFormat;
  quantity: number;
  frontUrl: string;
  backUrl: string;
  recipient: MailingAddress;
  sender?: MailingAddress;
  message?: string;
}

export interface PrintOrder {
  id: string;
  status: "draft" | "submitted" | "printing" | "mailed" | "delivered" | "failed";
  trackingUrl: string | null;
  createdAt: string;
}

export interface PrintProvider {
  readonly id: string;
  readonly enabled: boolean;
  quote(request: PrintQuoteRequest): Promise<PrintQuote>;
  createOrder(request: PrintOrderRequest): Promise<PrintOrder>;
  getOrder(id: string): Promise<PrintOrder | null>;
}

/** Indicative pricing so the UI can show a realistic cost breakdown. */
const INDICATIVE: Record<PrintFormat, { print: number; postage: number }> = {
  "postcard-6x4": { print: 149, postage: 135 },
  "postcard-7x5": { print: 189, postage: 155 },
  "print-8x10": { print: 599, postage: 425 },
};

class UnconfiguredProvider implements PrintProvider {
  readonly id = "unconfigured";
  readonly enabled = false;

  async quote({ format, quantity, destinationCountry }: PrintQuoteRequest): Promise<PrintQuote> {
    const unit = INDICATIVE[format];
    const international = destinationCountry.toUpperCase() !== "US" ? 60 : 0;
    const printCents = unit.print * quantity;
    const postageCents = (unit.postage + international) * quantity;
    return {
      currency: "USD",
      printCents,
      postageCents,
      totalCents: printCents + postageCents,
      estimatedDeliveryDays: [5, 12],
    };
  }

  async createOrder(): Promise<PrintOrder> {
    throw new Error(
      "Physical mailing is not available: no print provider is configured for this deployment.",
    );
  }

  async getOrder(): Promise<PrintOrder | null> {
    return null;
  }
}

export function getPrintProvider(): PrintProvider {
  // A real implementation is selected here once PRINT_PROVIDER + credentials
  // exist; until then every caller sees `enabled: false`.
  return new UnconfiguredProvider();
}

export function isPrintingConfigured(): boolean {
  return Boolean(process.env.PRINT_PROVIDER && process.env.PRINT_PROVIDER_API_KEY);
}

export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
