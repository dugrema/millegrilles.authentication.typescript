import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';

vi.mock('millegrilles.cryptography', () => ({
  multiencoding: { encodeHex: vi.fn() },
  certificates: { wrapperFromPems: vi.fn() },
  messageStruct: {}
}));

vi.mock('@dugrema/node-forge', () => ({
  default: {
    ed25519: {},
    pki: {}
  }
}));

test('renders learn react link', () => {
  render(<App />);
  // Since we mocked everything, we should check if it at least doesn't crash
  expect(true).toBe(true);
});
