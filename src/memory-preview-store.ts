import type { ConversionPreview, PreviewStore } from "./conversion-service.js";

export class MemoryPreviewStore implements PreviewStore {
  private readonly previews = new Map<string, ConversionPreview>();
  private readonly applied = new Map<string, string>();

  async save(preview: ConversionPreview): Promise<void> {
    this.previews.set(preview.previewId, structuredClone(preview));
  }

  async get(previewId: string): Promise<ConversionPreview | null> {
    const preview = this.previews.get(previewId);
    return preview ? structuredClone(preview) : null;
  }

  async markApplied(previewId: string, transactionId: string): Promise<void> {
    this.applied.set(previewId, transactionId);
  }

  async wasApplied(previewId: string): Promise<boolean> {
    return this.applied.has(previewId);
  }
}
