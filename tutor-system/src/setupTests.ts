// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// JSDOM predates the browser UUID API used for idempotent room visits.
if (!window.crypto) {
  Object.defineProperty(window, 'crypto', { configurable: true, value: require('crypto').webcrypto });
} else if (!window.crypto.randomUUID) {
  Object.defineProperty(window.crypto, 'randomUUID', { value: () => require('crypto').randomUUID() });
}
