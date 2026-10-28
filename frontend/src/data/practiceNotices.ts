import { platformApi } from './dataSource';
import { demoCall, demoEnabled } from '../demo/client';

export interface PracticeNotice {
  id: string;
  studentId: string;
  studentName: string;
  endDate: string;
  daysRemaining: number;
  isRead: boolean;
  isSounded: boolean;
}

export const practiceNotices = {
  list: () => demoEnabled ? demoCall<PracticeNotice[]>('listPracticeNotices') : platformApi.request<PracticeNotice[]>('/practice-notices'),
  read: (id: string) => demoEnabled ? demoCall<void>('markPracticeNoticeRead', id) : platformApi.request<void>(`/practice-notices/${encodeURIComponent(id)}/read`, { method: 'POST' }),
  sounded: (id: string) => demoEnabled ? demoCall<void>('markPracticeNoticeSounded', id) : platformApi.request<void>(`/practice-notices/${encodeURIComponent(id)}/sounded`, { method: 'POST' }),
};
