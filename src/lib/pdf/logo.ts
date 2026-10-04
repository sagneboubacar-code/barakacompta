// Logo d'école pour les PDF. @react-pdf ne lit que le PNG et le JPEG, et
// une image distante illisible ferait échouer TOUT le document : on la
// télécharge d'abord nous-mêmes, et au moindre doute on s'en passe.
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function fetchPdfLogo(
  url: string | null | undefined
): Promise<{ data: Buffer; format: "png" | "jpg" } | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    const format = type.includes("png") ? "png" : type.includes("jpeg") || type.includes("jpg") ? "jpg" : null;
    if (!format) return null;
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length === 0 || data.length > MAX_LOGO_BYTES) return null;
    return { data, format };
  } catch {
    return null;
  }
}
