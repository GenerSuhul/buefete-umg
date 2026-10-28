export type LegalStudyReviewType = 'FirstReview' | 'SecondReview' | 'WrittenSubmission';
export interface LegalStudyReview {
  id: string;
  reviewType: LegalStudyReviewType;
  reviewDate: string;
  observations: string;
  signedDocumentId: string;
  createdAtUtc: string;
}
export interface PracticeClosure {
  studentId: string;
  studentName: string;
  studentCardNumber: string;
  deliveryDate: string;
  finalDocumentId: string;
  notes: string;
  createdAtUtc: string;
}
export interface StudentLegalStudy {
  reviews: LegalStudyReview[];
  closure: PracticeClosure | null;
}
export interface AddLegalStudyReview {
  reviewType: LegalStudyReviewType;
  reviewDate: string;
  observations: string;
  signedDocumentId: string;
}
export interface DeliverLegalStudy {
  deliveryDate: string;
  finalDocumentId: string;
  notes: string;
}
