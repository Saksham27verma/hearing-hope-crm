import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enquiryHasPersistedGoogleReviewPrompt,
  shouldAskGoogleReviewOnSaleSave,
  visitLooksLikeHearingAidSale,
} from './googleReviewPrompt';

test('visitLooksLikeHearingAidSale detects explicit sale flags', () => {
  assert.equal(visitLooksLikeHearingAidSale({ hearingAidSale: true }), true);
  assert.equal(visitLooksLikeHearingAidSale({ purchaseFromTrial: true }), true);
  assert.equal(visitLooksLikeHearingAidSale({ hearingAidStatus: 'sold' }), true);
  assert.equal(visitLooksLikeHearingAidSale({ medicalServices: ['hearing_aid_sale'] }), true);
  assert.equal(visitLooksLikeHearingAidSale({ hearingAidBooked: true }), false);
});

test('shouldAskGoogleReviewOnSaleSave is true only on first sale save', () => {
  assert.equal(
    shouldAskGoogleReviewOnSaleSave({
      existingEnquiry: null,
      nextVisits: [{ hearingAidSale: true }],
    }),
    true,
  );
  assert.equal(
    shouldAskGoogleReviewOnSaleSave({
      existingEnquiry: { visits: [{ hearingAidBooked: true }] },
      nextVisits: [{ hearingAidSale: true }],
    }),
    true,
  );
});

test('shouldAskGoogleReviewOnSaleSave is false when enquiry already had a sale', () => {
  assert.equal(
    shouldAskGoogleReviewOnSaleSave({
      existingEnquiry: { visits: [{ hearingAidSale: true, invoiceNumber: 'HDIPL/26-27/1' }] },
      nextVisits: [{ hearingAidSale: true }],
    }),
    false,
  );
});

test('shouldAskGoogleReviewOnSaleSave is false after the prompt was already answered', () => {
  assert.equal(
    enquiryHasPersistedGoogleReviewPrompt({
      googleReviewPrompt: { completed: true, taken: false, reason: 'Patient declined' },
    }),
    true,
  );
  assert.equal(
    shouldAskGoogleReviewOnSaleSave({
      existingEnquiry: {
        visits: [{ hearingAidBooked: true }],
        googleReviewPrompt: { completed: true, taken: true, reason: '' },
      },
      nextVisits: [{ hearingAidSale: true }],
    }),
    false,
  );
});

test('shouldAskGoogleReviewOnSaleSave is false when this save has no sale', () => {
  assert.equal(
    shouldAskGoogleReviewOnSaleSave({
      existingEnquiry: null,
      nextVisits: [{ hearingAidBooked: true, hearingTest: true }],
    }),
    false,
  );
});
