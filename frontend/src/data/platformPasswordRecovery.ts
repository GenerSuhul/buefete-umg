import { platformApi } from './dataSource';

export const platformPasswordRecovery = {
  start: (email: string) => platformApi.request<{ challengeToken: string; message: string }>(
    '/auth/platform-password-recovery/start', { method: 'POST', body: JSON.stringify({ email }), headers: { 'X-Sede-Code': 'peten' } }, true),
  complete: (challengeToken: string, code: string, newPassword: string) => platformApi.request<void>(
    '/auth/platform-password-recovery/complete', { method: 'POST', body: JSON.stringify({ challengeToken, code, newPassword }), headers: { 'X-Sede-Code': 'peten' } }, true),
};
