import { apiFetch } from '../../../lib/api.ts';
import {
  OmnichannelOverviewMetrics,
  RecurrenceSummary,
  RbxCorrelationResult,
  ImportBatch,
  BatchError,
  ReviewItem,
  PreviewData,
  ContactFact,
  ClientInteractionsResponse,
} from '../types/omnichannel.types.ts';

export const omnichannelApi = {
  /**
   * Fetches high-level metrics for volume, efficiency, CSAT, closures and classifications.
   */
  async getOverview(params: {
    batchId?: string;
    agent?: string;
    startDate?: string;
    endDate?: string;
    department?: string;
    status?: string;
    isAutomation?: boolean;
  }): Promise<{ success: boolean; metrics: OmnichannelOverviewMetrics }> {
    const query = new URLSearchParams();
    if (params.batchId) query.set('batchId', params.batchId);
    if (params.agent) query.set('agent', params.agent);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.department) query.set('department', params.department);
    if (params.status) query.set('status', params.status);
    if (params.isAutomation !== undefined) query.set('isAutomation', String(params.isAutomation));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch(`/api/omnichannel/overview${qs}`);
  },

  /**
   * Fetches recurrence indicators and rankings.
   */
  async getRecurrence(params: {
    batchId?: string;
    agent?: string;
    startDate?: string;
    endDate?: string;
    department?: string;
    threshold?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; recurrence: RecurrenceSummary }> {
    const query = new URLSearchParams();
    if (params.batchId) query.set('batchId', params.batchId);
    if (params.agent) query.set('agent', params.agent);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.department) query.set('department', params.department);
    if (params.threshold) query.set('threshold', String(params.threshold));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch(`/api/omnichannel/recurrence${qs}`);
  },

  /**
   * Fetches cross-reference data with RBX tickets.
   */
  async getCrossRbx(params: {
    batchId?: string;
    agent?: string;
    department?: string;
    windowHours?: number;
    customWindowStart?: string;
    customWindowEnd?: string;
  }): Promise<{ success: boolean; correlation: RbxCorrelationResult }> {
    const query = new URLSearchParams();
    if (params.batchId) query.set('batchId', params.batchId);
    if (params.agent) query.set('agent', params.agent);
    if (params.department) query.set('department', params.department);
    if (params.windowHours) query.set('windowHours', String(params.windowHours));
    if (params.customWindowStart) query.set('customWindowStart', params.customWindowStart);
    if (params.customWindowEnd) query.set('customWindowEnd', params.customWindowEnd);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch(`/api/omnichannel/cross-rbx${qs}`);
  },

  /**
   * Fetches detailed interactions and correlated RBX tickets for a single client (for recurrence modal).
   */
  async getClientInteractions(params: {
    batchId?: string;
    clientKey?: string;
    rbxClientId?: string;
    phoneMasked?: string;
  }): Promise<ClientInteractionsResponse> {
    const query = new URLSearchParams();
    if (params.batchId) query.set('batchId', params.batchId);
    if (params.clientKey) query.set('clientKey', params.clientKey);
    if (params.rbxClientId) query.set('rbxClientId', params.rbxClientId);
    if (params.phoneMasked) query.set('phoneMasked', params.phoneMasked);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch(`/api/omnichannel/client-interactions${qs}`);
  },

  /**
   * Fetches detailed contacts paginated list.
   */
  async getContacts(params: {
    batchId?: string;
    agent?: string;
    department?: string;
    closureType?: string;
    classification?: string;
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Promise<{ success: boolean; contacts: ContactFact[]; totalCount: number }> {
    const query = new URLSearchParams();
    if (params.batchId) query.set('batchId', params.batchId);
    if (params.agent) query.set('agent', params.agent);
    if (params.department) query.set('department', params.department);
    if (params.closureType) query.set('closureType', params.closureType);
    if (params.classification) query.set('classification', params.classification);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortDir) query.set('sortDir', params.sortDir);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.search) query.set('search', params.search);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch(`/api/omnichannel/contacts${qs}`);
  },

  /**
   * Lists recent imported batches.
   */
  async listBatches(): Promise<{ success: boolean; batches: ImportBatch[] }> {
    return apiFetch('/api/omnichannel/batches');
  },

  /**
   * Gets specific batch details with rejection errors.
   */
  async getBatchDetails(batchId: string): Promise<{ success: boolean; batch: ImportBatch; errors: BatchError[] }> {
    return apiFetch(`/api/omnichannel/batches/${batchId}`);
  },

  /**
   * Polls batch status by ID.
   */
  async getBatchStatus(batchId: string): Promise<{ success: boolean; batch: ImportBatch }> {
    return apiFetch(`/api/omnichannel/import/${batchId}/status`);
  },

  /**
   * Uploads file for inline preview (first 50 rows, detected columns).
   */
  async uploadPreview(file: File): Promise<{
    success: boolean;
    preview: PreviewData;
    tempFilePath: string;
    fileName: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/omnichannel/import/preview', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Erro no upload' }));
      throw new Error(err.message || 'Falha ao processar prévia do arquivo.');
    }

    return response.json();
  },

  /**
   * Confirms enqueuing the batch import.
   */
  async confirmImport(tempFilePath: string, fileName: string): Promise<{
    batchId: string;
    status: string;
    message: string;
  }> {
    return apiFetch('/api/omnichannel/import', {
      method: 'POST',
      body: JSON.stringify({ tempFilePath, fileName }),
    });
  },

  /**
   * Direct multipart import fallback.
   */
  async directImport(file: File): Promise<{
    batchId: string;
    status: string;
    message: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/omnichannel/import', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Erro no upload' }));
      throw new Error(err.message || 'Falha ao iniciar importação.');
    }

    return response.json();
  },

  /**
   * Gets items in review queue.
   */
  async getReviewQueue(params: {
    batchId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    success: boolean;
    items: ReviewItem[];
    totalSuggested: number;
    totalAmbiguous: number;
  }> {
    const query = new URLSearchParams();
    if (params.batchId) query.set('batchId', params.batchId);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch(`/api/omnichannel/reviews${qs}`);
  },

  /**
   * Submits a manual match decision.
   */
  async applyReviewDecision(params: {
    factId: string;
    newStatus: 'confirmed' | 'unmatched';
    selectedRbxClientId?: string;
    reason: string;
  }): Promise<{ success: boolean; message: string }> {
    return apiFetch('/api/omnichannel/reviews/decision', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /**
   * Bulk approves all suggested matches in a batch.
   */
  async batchApproveSuggested(
    batchId: string,
    reason?: string
  ): Promise<{ success: boolean; approvedCount: number; message: string }> {
    return apiFetch('/api/omnichannel/reviews/batch-approve', {
      method: 'POST',
      body: JSON.stringify({
        batchId,
        reason: reason || 'Aprovação em lote autorizada pelo supervisor',
      }),
    });
  },

  /**
   * Applies batch decision on selected facts (approve or unmatch, with optional target client for merging).
   */
  async batchDecision(params: {
    factIds: string[];
    action: 'confirm' | 'unmatch';
    targetClientId?: string;
    reason?: string;
  }): Promise<{ success: boolean; affectedCount: number; message: string }> {
    return apiFetch('/api/omnichannel/reviews/batch-decision', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /**
   * Deletes an imported batch and its related records.
   * Can optionally preserve confirmed customer mappings.
   */
  async deleteBatch(
    batchId: string,
    preserveLearnedMappings = true
  ): Promise<{ success: boolean; message: string; preservedMappingsCount?: number }> {
    return apiFetch(
      `/api/omnichannel/batches/${batchId}?preserveLearnedMappings=${preserveLearnedMappings}`,
      {
        method: 'DELETE',
      }
    );
  },
};
