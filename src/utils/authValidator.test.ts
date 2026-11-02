import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAuthInput,
  formatFirebaseAuthError,
  getUserInitials,
} from './authValidator';

test('validateAuthInput validates signin, signup, and reset modes cleanly', () => {
  const emptyEmail = validateAuthInput({ mode: 'signin', email: '  ', password: 'password123' });
  assert.equal(emptyEmail.valid, false);
  assert.ok(emptyEmail.error?.includes('email'));

  const badEmail = validateAuthInput({ mode: 'signin', email: 'not-an-email', password: 'password123' });
  assert.equal(badEmail.valid, false);
  assert.ok(badEmail.error?.includes('valid email'));

  const resetValid = validateAuthInput({ mode: 'reset', email: ' Explorer@Example.com ' });
  assert.equal(resetValid.valid, true);
  assert.equal(resetValid.normalizedEmail, 'explorer@example.com');

  const signupMissingName = validateAuthInput({
    mode: 'signup',
    email: 'user@example.com',
    password: 'password123',
    displayName: ' ',
  });
  assert.equal(signupMissingName.valid, false);
  assert.ok(signupMissingName.error?.includes('display name'));

  const signupShortPass = validateAuthInput({
    mode: 'signup',
    email: 'user@example.com',
    password: 'short',
    displayName: 'Ada Lovelace',
  });
  assert.equal(signupShortPass.valid, false);
  assert.ok(signupShortPass.error?.includes('8 characters'));

  const signupValid = validateAuthInput({
    mode: 'signup',
    email: 'Ada@Example.com',
    password: 'securePassword123',
    displayName: ' Ada Lovelace ',
  });
  assert.equal(signupValid.valid, true);
  assert.equal(signupValid.normalizedEmail, 'ada@example.com');
  assert.equal(signupValid.normalizedDisplayName, 'Ada Lovelace');
});

test('formatFirebaseAuthError maps Firebase error codes and suppresses user-cancelled popups', () => {
  assert.equal(
    formatFirebaseAuthError({ code: 'auth/popup-closed-by-user', message: 'Popup closed' }),
    ''
  );
  assert.ok(
    formatFirebaseAuthError({ code: 'auth/invalid-credential', message: 'Firebase: Error' }).includes(
      'Invalid email or password'
    )
  );
  assert.ok(
    formatFirebaseAuthError({ code: 'auth/email-already-in-use', message: 'In use' }).includes(
      'already exists'
    )
  );
});

test('getUserInitials extracts 1-2 uppercase initials from displayName or email', () => {
  assert.equal(getUserInitials('Maya Lin', 'maya@example.com'), 'ML');
  assert.equal(getUserInitials(null, 'explorer@atlaspulse.io'), 'EX');
  assert.equal(getUserInitials('', ''), 'U');
});
