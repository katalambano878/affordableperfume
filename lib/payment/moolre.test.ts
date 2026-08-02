/**
 * Manual / node --test matrix for Moolre payment helpers.
 * Run: npx tsx --test lib/payment/moolre.test.ts
 * (or document results in PAYMENT_DATABASE_AUDIT.md if no test runner)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMoolrePaymentSuccessful } from './moolre';

describe('isMoolrePaymentSuccessful', () => {
  it('accepts txstatus=1 with status=1', () => {
    assert.equal(
      isMoolrePaymentSuccessful({
        status: 1,
        message: 'Transaction Successful',
        data: { txstatus: 1, amount: '100' },
      }),
      true
    );
  });

  it('accepts txtstatus alias', () => {
    assert.equal(
      isMoolrePaymentSuccessful({
        status: 1,
        message: 'ok',
        data: { txtstatus: 1, amount: '50' },
      }),
      true
    );
  });

  it('rejects not found', () => {
    assert.equal(
      isMoolrePaymentSuccessful({
        status: 1,
        message: 'Transaction not found',
        data: { txstatus: 0 },
      }),
      false
    );
  });

  it('rejects missing data', () => {
    assert.equal(isMoolrePaymentSuccessful({ status: 1, message: 'ok' }), false);
  });

  it('rejects failed message', () => {
    assert.equal(
      isMoolrePaymentSuccessful({
        status: 1,
        message: 'Payment failed',
        data: { txstatus: 1 },
      }),
      false
    );
  });
});
