import type { PricingPreview, PricingPreviewStore } from "./service.js";

export class MemoryPricingPreviewStore implements PricingPreviewStore {
  private readonly previews = new Map<string, PricingPreview>();
  private readonly applied = new Map<string, string>();

  async save(preview: PricingPreview): Promise<void> {
    this.previews.set(preview.previewId, structuredClone(preview));
  }

  async get(previewId: string): Promise<PricingPreview | null> {
    const preview = this.previews.get(previewId);
    return preview ? structuredClone(preview) : null;
  }

  async wasApplied(previewId: string): Promise<boolean> {
    return this.applied.has(previewId);
  }

  async markApplied(previewId: string, transactionId: string): Promise<void> {
    this.applied.set(previewId, transactionId);
  }
}
