export type EvidenceWatermark = {
  reportNumber: string;
  uploadedAt: string;
  employeeName: string;
  location: string;
  gps?: { latitude: number; longitude: number };
};
export type EvidenceDerivative = { bytes: ArrayBuffer; contentType: "image/jpeg"; sha256: string };
export interface EvidenceImageProcessor {
  createDerivative(original: ReadableStream, watermark: EvidenceWatermark): Promise<EvidenceDerivative>;
}
function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}
export function evidenceWatermarkLines(value: EvidenceWatermark) {
  return ["ServiceLOGME", `${value.reportNumber} · Uploaded ${value.uploadedAt}`, `${value.employeeName} · ${value.location}${value.gps ? ` · GPS ${value.gps.latitude.toFixed(6)}, ${value.gps.longitude.toFixed(6)}` : ""}`];
}
export class CloudflareEvidenceImageProcessor implements EvidenceImageProcessor {
  constructor(private images: ImagesBinding) {}
  async createDerivative(original: ReadableStream, watermark: EvidenceWatermark): Promise<EvidenceDerivative> {
    const lines = evidenceWatermarkLines(watermark);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="156"><rect width="1600" height="156" fill="#101522" fill-opacity="0.82"/><g fill="#fff" font-family="Arial,Helvetica,sans-serif"><text x="28" y="42" font-size="25" font-weight="700">${escapeXml(lines[0])}</text><text x="28" y="82" font-size="21">${escapeXml(lines[1])}</text><text x="28" y="120" font-size="19">${escapeXml(lines[2])}</text></g></svg>`;
    const overlay = new Blob([svg], { type: "image/svg+xml" }).stream();
    const transformed = await this.images.input(original).transform({ width: 1600, fit: "scale-down" }).draw(overlay, { bottom: 0, left: 0 }).output({ format: "image/jpeg", quality: 85 });
    const bytes = await transformed.response().arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    return { bytes, contentType: "image/jpeg", sha256 };
  }
}
