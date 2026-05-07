import { createHash } from "crypto";
import { normalizeHeader } from "./column-mapping";

export type HeaderSignatureInput = {
  headers: string[];
  headerRowIndex: number;
};

export function computeHeaderSignature(input: HeaderSignatureInput): string {
  const normalized = input.headers.map((h) => normalizeHeader(h)).filter(Boolean).sort();
  const raw = `${input.headerRowIndex}|${normalized.join("\u001f")}`;
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
