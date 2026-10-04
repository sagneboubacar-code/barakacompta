import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { loadStudentReceipt } from "@/lib/receipts/data";
import { receiptPdfResponse } from "@/lib/receipts/pdf-response";

// @react-pdf/renderer s'appuie sur des API Node (streams, Buffer).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const receipt = await loadStudentReceipt(createClient(), params.id, appUser.school_id ?? "", "fr");
  return receiptPdfResponse(receipt);
}
