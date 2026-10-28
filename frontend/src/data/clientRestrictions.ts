import { platformApi } from './dataSource';
import { demoCall, demoEnabled } from '../demo/client';
import type { ClientRestriction, ClientRestrictionStatus, PagedResult } from '../types/domain';

export const clientRestrictions = {
  check: (dpi: string) => demoEnabled ? demoCall<ClientRestrictionStatus>('checkClientRestriction', dpi) : platformApi.request<ClientRestrictionStatus>('/client-restrictions/check', { method: 'POST', body: JSON.stringify({ dpi }) }),
  list: (dpi: string, page: number) => demoEnabled ? demoCall<PagedResult<ClientRestriction>>('listClientRestrictions', dpi, page) : platformApi.request<PagedResult<ClientRestriction>>(`/client-restrictions?page=${page}&pageSize=20${dpi ? `&dpi=${encodeURIComponent(dpi)}` : ''}`),
  create: (dpi: string, confirmDpi: string, reason: string) => demoEnabled ? demoCall<ClientRestriction>('createClientRestriction', dpi, confirmDpi, reason) : platformApi.request<ClientRestriction>('/client-restrictions', { method: 'POST', body: JSON.stringify({ dpi, confirmDpi, reason }) }),
  remove: (id: string, reason: string) => demoEnabled ? demoCall<void>('removeClientRestriction', id, reason) : platformApi.request<void>(`/client-restrictions/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
};
