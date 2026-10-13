import { platformApi } from './dataSource';
import type { ClientRestriction, ClientRestrictionStatus, PagedResult } from '../types/domain';

export const clientRestrictions = {
  check: (dpi: string) => platformApi.request<ClientRestrictionStatus>('/client-restrictions/check', { method: 'POST', body: JSON.stringify({ dpi }) }),
  list: (dpi: string, page: number) => platformApi.request<PagedResult<ClientRestriction>>(`/client-restrictions?page=${page}&pageSize=20${dpi ? `&dpi=${encodeURIComponent(dpi)}` : ''}`),
  create: (dpi: string, confirmDpi: string, reason: string) => platformApi.request<ClientRestriction>('/client-restrictions', { method: 'POST', body: JSON.stringify({ dpi, confirmDpi, reason }) }),
};
