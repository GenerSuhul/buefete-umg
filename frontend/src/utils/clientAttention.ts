import type { Client } from '../types/domain';

export function clientAttention(client: Pick<Client, 'isActive' | 'restriction'>, restriction = client.restriction): { label: string; tone: 'danger' | 'warning' | 'success' | 'neutral' } {
  if (restriction?.isRestricted) return { label: 'Lista negra', tone: 'danger' };
  if (restriction?.hasValidIdentity === false) return { label: 'Identidad pendiente', tone: 'warning' };
  return client.isActive
    ? { label: 'Atención vigente', tone: 'success' }
    : { label: 'Sin atención vigente', tone: 'neutral' };
}
