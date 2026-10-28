import 'server-only';
import { audit, ensure, type DemoState } from './model';
import type { UserSummary } from '../types/domain';
import type { PracticeNotice } from '../data/practiceNotices';

const readAction = 'PracticeEndNoticeRead';
const soundedAction = 'PracticeEndNoticeSounded';
const dateNumber = (value: string) => Math.floor(Date.parse(`${value}T00:00:00Z`) / 86_400_000);

export function practiceNoticeOperation(state: DemoState, user: UserSummary, method: string, args: unknown[]): PracticeNotice[] | null {
  ensure(user.roles.includes('AdministradorGeneral') || user.roles.includes('Secretaria'), 'No tiene acceso a los avisos de práctica.', 403);
  const today = new Date().toISOString().slice(0, 10);
  const day = dateNumber(today);
  const notices = state.students.flatMap(profile => profile.enrollments
    .filter(enrollment => profile.student.isActive && enrollment.endDate &&
      !['Rejected', 'Completed'].includes(enrollment.status) &&
      dateNumber(enrollment.endDate) >= day && dateNumber(enrollment.endDate) <= day + 15)
    .map(enrollment => ({
      id: enrollment.id, studentId: profile.student.id, studentName: profile.student.fullName,
      endDate: enrollment.endDate!, daysRemaining: dateNumber(enrollment.endDate!) - day,
      isRead: state.audit.some(entry => entry.userId === user.id && entry.entityId === enrollment.id && entry.action === readAction),
      isSounded: state.audit.some(entry => entry.userId === user.id && entry.entityId === enrollment.id && entry.action === soundedAction),
    }))).sort((left, right) => left.endDate.localeCompare(right.endDate));
  if (method === 'listPracticeNotices') return notices;
  const id = String(args[0] ?? '');
  ensure(notices.some(item => item.id === id), 'El aviso ya no está vigente.', 404);
  const action = method === 'markPracticeNoticeRead' ? readAction : soundedAction;
  ensure(method === 'markPracticeNoticeRead' || method === 'markPracticeNoticeSounded', 'Operación inválida.', 400);
  if (!state.audit.some(entry => entry.userId === user.id && entry.entityId === id && entry.action === action)) audit(state, user, action, id);
  return null;
}
