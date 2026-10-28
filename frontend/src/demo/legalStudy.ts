import type { UserSummary } from '../types/domain';
import type { LegalStudyReviewType, StudentLegalStudy } from '../types/studentLegalStudy';
import { audit, ensure, id, matches, now, paged, requireValue, type DemoState } from './model';

const methods = new Set(['getStudentLegalStudy', 'addStudentLegalReview', 'deliverStudentLegalStudy', 'listPracticeClosures']);
export function isLegalStudyOperation(method: string) { return methods.has(method); }

export function legalStudyOperation(state: DemoState, user: UserSummary, method: string, args: unknown[]) {
  const staff = user.roles.some(role => role === 'AdministradorGeneral' || role === 'Secretaria');
  const studies = state.studentLegalStudies ??= {};
  if (method === 'listPracticeClosures') {
    ensure(staff, 'No tiene permiso para consultar cierres de práctica.', 403);
    const options = (args[0] ?? {}) as Record<string, unknown>;
    return paged(Object.values(studies).flatMap(item => item.closure ? [item.closure] : [])
      .filter(item => !state.deleted.some(deleted => deleted.type === 'Student' && deleted.id === item.studentId))
      .filter(item => matches([item.studentName, item.studentCardNumber], options.search))
      .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate)), options);
  }
  const studentId = String(args[0]);
  const profile = requireValue(state.students.find(item => item.student.id === studentId &&
    !state.deleted.some(deleted => deleted.type === 'Student' && deleted.id === studentId)), 'No se encontró el alumno.');
  ensure(staff || profile.student.userAccountId === user.id && profile.student.isActive, 'No tiene permiso para consultar este alumno.', 403);
  const study: StudentLegalStudy = studies[studentId] ?? { reviews: [], closure: null };
  if (method === 'getStudentLegalStudy') return study;
  ensure(staff, 'Solo administración o secretaría puede registrar el estudio jurídico.', 403);
  ensure(profile.student.isActive && !study.closure, 'La práctica está cerrada o el alumno está inactivo.', 409);
  ensure(profile.enrollments.some(item => item.status === 'Approved'), 'La inscripción del alumno debe estar aprobada antes de registrar el estudio jurídico.', 409);
  const data = args[1] as Record<string, unknown>;
  ensure(data && typeof data === 'object', 'Complete los datos de la revisión.');
  const date = String(method === 'deliverStudentLegalStudy' ? data.deliveryDate ?? '' : data.reviewDate ?? '');
  const today = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && date >= profile.student.registrationDate && date <= today,
    'La fecha debe estar entre la inscripción y hoy.');
  const documentId = String(method === 'deliverStudentLegalStudy' ? data.finalDocumentId ?? '' : data.signedDocumentId ?? '');
  const document = requireValue(state.documents.find(item => item.id === documentId), 'Adjunte un PDF firmado válido de esta sede.');
  ensure(document.contextType === 'Student' && document.contextId === studentId && document.contentType === 'application/pdf',
    'Adjunte un PDF firmado asociado a este alumno.');
  const notes = String(method === 'deliverStudentLegalStudy' ? data.notes ?? '' : data.observations ?? '').trim();
  ensure(notes.length <= 4000, 'Las observaciones admiten hasta 4000 caracteres.');
  if (method === 'addStudentLegalReview') {
    const reviewType = String(data.reviewType) as LegalStudyReviewType;
    ensure(['FirstReview', 'SecondReview', 'WrittenSubmission'].includes(reviewType), 'Seleccione el tipo de revisión.');
    ensure(notes.length > 0, 'Escriba las observaciones de la revisión.');
    study.reviews.push({ id: id(), reviewType, reviewDate: date, observations: notes, signedDocumentId: documentId, createdAtUtc: now() });
    study.reviews.sort((a, b) => a.reviewDate.localeCompare(b.reviewDate) || a.createdAtUtc.localeCompare(b.createdAtUtc));
    audit(state, user, 'LegalStudyReviewRegistered', studentId);
  } else {
    ensure(study.reviews.length > 0, 'Registre al menos una revisión firmada antes de entregar el estudio jurídico.', 409);
    ensure(study.reviews.every(review => review.reviewDate <= date), 'La entrega no puede ser anterior a una revisión registrada.');
    study.closure = { studentId, studentName: profile.student.fullName, studentCardNumber: profile.student.studentCardNumber,
      deliveryDate: date, finalDocumentId: documentId, notes, createdAtUtc: now() };
    profile.student.isActive = false;
    profile.student.concurrencyToken = id();
    for (const enrollment of profile.enrollments) {
      if (enrollment.status === 'Rejected' || enrollment.status === 'Completed') continue;
      enrollment.status = 'Completed'; enrollment.resolvedAtUtc = now();
      enrollment.resolutionNotes = 'Práctica cerrada por entrega del estudio jurídico.'; enrollment.concurrencyToken = id();
    }
    const account = state.users.find(item => item.id === profile.student.userAccountId);
    if (account) { account.isActive = false; account.accessStatus = 'Suspended'; }
    for (const legalCase of state.cases) {
      for (const assignment of legalCase.summary.assignments.filter(item => item.studentId === studentId && item.status === 'Active')) {
        assignment.status = 'Completed'; assignment.endedAtUtc = now(); assignment.endReason = 'Práctica cerrada por entrega del estudio jurídico.';
        legalCase.timeline.push({ id: id(), type: 'Assignment', title: 'Cierre de práctica del alumno', description: `${profile.student.fullName}: estudio jurídico entregado; asignación finalizada.`, occurredAtUtc: now(), performedByStudentId: studentId, createdByUserId: user.id, documentId: null });
      }
    }
    audit(state, user, 'PracticeClosed', studentId);
  }
  studies[studentId] = study;
  return study;
}
