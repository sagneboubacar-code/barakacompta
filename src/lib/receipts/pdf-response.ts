import { NextResponse } from "next/server";
import { renderReceiptPdf, receiptFileName } from "@/lib/receipts/pdf";
import type { ReceiptData } from "@/lib/receipts/data";

// Réponse commune aux routes de reçus PDF (élève et famille).
export async function receiptPdfResponse(receipt: ReceiptData | null): Promise<NextResponse> {
  if (!receipt) {
    return NextResponse.json({ error: "Reçu introuvable." }, { status: 404 });
  }

  // Le rendu PDF dépend de ressources résolues à l'exécution (polices) : une
  // panne se manifesterait sinon par un 500 muet, impossible à diagnostiquer
  // depuis l'école. On journalise et on renvoie un message lisible.
  let pdf: Buffer;
  try {
    pdf = await renderReceiptPdf(receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[recu-pdf] échec du rendu", error);
    return NextResponse.json({ error: "Génération du PDF impossible.", detail: message }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline` : le reçu s'ouvre dans l'onglet (aperçu, partage depuis le
      // téléphone) ; le lien de téléchargement force l'enregistrement.
      "Content-Disposition": `inline; filename="${receiptFileName(receipt)}"`,
      "Cache-Control": "no-store",
    },
  });
}
