/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare module "pdf-parse" {
  export default function pdfParse(buf: Buffer): Promise<{
    text: string; numpages: number; info: Record<string, unknown>;
    metadata: Record<string, unknown>; version: string;
  }>;
}
declare module "mammoth" {
  export function extractRawText(opts: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: Array<{ message: string }> }>;
}
