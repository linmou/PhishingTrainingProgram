// #!/usr/bin/env node
// Covers AISuggestionBox.tsx: Cyberbullying character selection, shared review actions, and generation state.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AISuggestionBox from '../../components/AISuggestionBox';

const props = () => ({
  suggestion: 'Draft reply', isVisible: true, character: 'same_age_peer' as const,
  quickAdjustEnabled: false, onCopy: jest.fn(), onReject: jest.fn(), onRegenerate: jest.fn(),
  onCharacterChange: jest.fn(), onToggleGuard: jest.fn(),
});

test('offers five characters and retains independent review controls', () => {
  const input = props();
  render(<AISuggestionBox {...input} />);
  expect(screen.getAllByRole('option').map(option => option.getAttribute('value')))
    .toEqual(['same_age_peer', 'older_peer', 'victim', 'bully', 'educator']);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'educator' } });
  expect(input.onCharacterChange).toHaveBeenCalledWith('educator');
  fireEvent.click(screen.getByRole('button', { name: 'Activate Guard' }));
  expect(input.onToggleGuard).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Copy to Input' }));
  expect(input.onCopy).toHaveBeenCalledWith(input.suggestion);
  fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
  expect(input.onReject).toHaveBeenCalledTimes(1);
});

test('regenerates with character workflow parameters', () => {
  const input = props();
  render(<AISuggestionBox {...input} />);
  expect(screen.queryByText('Quick Adjust')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
  expect(input.onRegenerate).toHaveBeenCalledWith({});
});

test('holds character and publish preparation while generation is pending', () => {
  render(<AISuggestionBox {...props()} isRegenerating />);
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Copy to Input' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
});

test('ordinary tutor retains parameter controls and no character selector', () => {
  render(<AISuggestionBox {...props()} character={null} quickAdjustEnabled />);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.getByText('Quick Adjust')).toBeInTheDocument();
});
