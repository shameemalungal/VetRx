// ==============================================================================
// VetRx — Invoices API Client (web/src/services/api/invoicesApi.ts)
// Server-Authoritative PostgreSQL Access via /api/invoices
// ==============================================================================

import { apiRequest } from './apiClient';
import type { Invoice, InvoiceItem } from '../../types';

export interface ServerInvoiceItem {
  id: string;
  invoiceId: string;
  prescriptionId?: string | null;
  description: string;
  category?: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

export interface ServerInvoice {
  id: string;
  practiceId: string;
  patientId?: string | null;
  invoiceNumber: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: ServerInvoiceItem[];
  patient?: {
    id: string;
    name: string;
    species: string;
    owner?: {
      id: string;
      name: string;
      phone: string;
    };
  };
}

export function normalizeServerInvoice(si: ServerInvoice): Invoice & { items: InvoiceItem[]; patient?: any; owner?: any } {
  const items: InvoiceItem[] = (si.items || []).map((itm, idx) => {
    const unitPricePaisa = Math.round(itm.unitPrice * 100);
    const totalPricePaisa = Math.round(itm.totalPrice * 100);
    return {
      id: itm.id,
      invoiceId: si.id,
      prescriptionId: itm.prescriptionId || undefined,
      description: itm.description,
      category: (itm.category as any) || 'Other',
      quantity: itm.quantity,
      unit: 'unit',
      unitPricePaisa,
      discountPct: 0,
      discountAmtPaisa: 0,
      subtotalPaisa: totalPricePaisa,
      taxPct: 0,
      taxAmtPaisa: 0,
      lineTotalPaisa: totalPricePaisa,
      totalPricePaisa,
      sortOrder: idx,
    };
  });

  return {
    id: si.id,
    invoiceNumber: si.invoiceNumber,
    patientId: si.patientId || '',
    ownerId: si.patient?.owner?.id || '',
    practitionerId: '',
    invoiceDate: new Date(si.createdAt),
    discountTotal: Math.round(si.discountAmount * 100),
    taxTotal: Math.round(si.taxAmount * 100),
    grandTotal: Math.round(si.totalAmount * 100),
    status: (si.status.charAt(0).toUpperCase() + si.status.slice(1).toLowerCase()) as any,
    items,
    patient: si.patient,
    owner: si.patient?.owner,
    createdAt: new Date(si.createdAt),
    updatedAt: new Date(si.updatedAt),
  };
}

export const invoicesApi = {
  async list(params?: { search?: string; status?: string; patientId?: string }): Promise<Array<Invoice & { items: InvoiceItem[]; patient?: any; owner?: any }>> {
    const list = await apiRequest<ServerInvoice[]>('/api/invoices', {
      method: 'GET',
      params,
    });
    return (list || []).map(normalizeServerInvoice);
  },

  async getById(id: string): Promise<Invoice & { items: InvoiceItem[]; patient?: any; owner?: any }> {
    const item = await apiRequest<ServerInvoice>(`/api/invoices/${id}`, {
      method: 'GET',
    });
    return normalizeServerInvoice(item);
  },

  async create(data: any): Promise<Invoice & { items: InvoiceItem[]; patient?: any; owner?: any }> {
    const created = await apiRequest<ServerInvoice>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return normalizeServerInvoice(created);
  },

  async update(id: string, data: any): Promise<Invoice & { items: InvoiceItem[]; patient?: any; owner?: any }> {
    const updated = await apiRequest<ServerInvoice>(`/api/invoices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return normalizeServerInvoice(updated);
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/invoices/${id}`, {
      method: 'DELETE',
    });
  },
};
