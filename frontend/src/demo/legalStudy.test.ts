import { describe, expect, it } from 'vitest';
import { legalStudyOperation } from './legalStudy';
import { emptyState, id } from './model';
import type { DocumentRecord, Enrollment, Student, StudentProfile, UserSummary } from '../types/domain';

function scenario() {
  const state = emptyState('admin@example.test');
  const studentId = id(); const accountId = id(); const documentId = id();
  const student: Student = { id: studentId, userAccountId: accountId, fullName: 'Alumno QA', studentCardNumber: 'QA-01', dpi: '1111 11111 1111', email: '', registrationDate: '2026-01-01', isActive: true, residenceAddress: 'QA', birthDate: null, ageAtRegistration: null, semester: null, studyShift: null, workplace: null, workPhone: null, immediateSupervisor: null, jobTitle: null, mobilePhone: null, homePhone: null, concurrencyToken: id() };
  const account: UserSummary = { ...state.users[0], id: accountId, fullName: student.fullName, roles: ['Alumno'], email: 'alumno@example.test' };
  state.users.push(account);
  state.students.push({ student, cases: [], enrollments: [{ id: id(), status: 'Approved', studentId }] as Enrollment[] } as StudentProfile);
  state.documents.push({ id: documentId, contextType: 'Student', contextId: studentId, contentType: 'application/pdf', storagePath: 'private/qa.pdf' } as DocumentRecord & { storagePath: string });
  return { state, student, account, documentId, admin: state.users[0] };
}
describe('Estudio jurídico y cierre de práctica', () => {
  it('rechaza documentos de otro propietario y la entrega sin revisión', () => {
    const { state, student, admin, documentId } = scenario();
    expect(() => legalStudyOperation(state, admin, 'deliverStudentLegalStudy', [student.id, { deliveryDate: '2026-01-03', finalDocumentId: documentId }])).toThrow(/al menos una revisión/);
    state.documents[0].contextId = id();
    expect(() => legalStudyOperation(state, admin, 'addStudentLegalReview', [student.id, { reviewType: 'FirstReview', reviewDate: '2026-01-02', signedDocumentId: documentId, observations: 'Corregir' }])).toThrow(/asociado a este alumno/);
  });
  it('conserva revisiones, cierra la práctica y revoca el acceso sin borrar la ficha', () => {
    const { state, student, admin, account, documentId } = scenario();
    legalStudyOperation(state, admin, 'addStudentLegalReview', [student.id, { reviewType: 'FirstReview', reviewDate: '2026-01-02', signedDocumentId: documentId, observations: 'Revisión firmada' }]);
    legalStudyOperation(state, admin, 'deliverStudentLegalStudy', [student.id, { deliveryDate: '2026-01-03', finalDocumentId: documentId, notes: 'Entrega final' }]);
    expect(state.studentLegalStudies?.[student.id].reviews).toHaveLength(1);
    expect(state.studentLegalStudies?.[student.id].closure?.finalDocumentId).toBe(documentId);
    expect(student.isActive).toBe(false); expect(account.isActive).toBe(false);
    expect(state.students).toHaveLength(1); expect(state.deleted).toHaveLength(0);
    expect(() => legalStudyOperation(state, admin, 'deliverStudentLegalStudy', [student.id, {}])).toThrow(/cerrada/);
  });
  it('permite consulta propia, pero exige personal autorizado para registrar y listar cierres', () => {
    const { state, student, account } = scenario();
    expect(legalStudyOperation(state, account, 'getStudentLegalStudy', [student.id])).toEqual({ reviews: [], closure: null });
    expect(() => legalStudyOperation(state, account, 'addStudentLegalReview', [student.id, {}])).toThrow(/administración o secretaría/);
    expect(() => legalStudyOperation(state, account, 'listPracticeClosures', [{}])).toThrow(/permiso/);
  });
});
