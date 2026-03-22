// frontend/src/components/WalletErrorBoundary.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WalletErrorBoundary from './WalletErrorBoundary';
import '@testing-library/jest-dom';

// Component that throws an error
const ThrowError = ({ shouldThrow, errorMessage }) => {
  if (shouldThrow) {
    throw new Error(errorMessage || 'Test error');
  }
  return <div>No error</div>;
};

describe('WalletErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when there is no error', () => {
    render(
      <WalletErrorBoundary>
        <div>Wallet content</div>
      </WalletErrorBoundary>
    );

    expect(screen.getByText('Wallet content')).toBeInTheDocument();
  });

  it('renders wallet error UI when child component throws', () => {
    render(
      <WalletErrorBoundary>
        <ThrowError shouldThrow={true} />
      </WalletErrorBoundary>
    );

    expect(screen.getByText('Wallet Error')).toBeInTheDocument();
    expect(screen.getByText(/An error occurred while processing your wallet request/)).toBeInTheDocument();
  });

  it('detects wallet connection errors', () => {
    render(
      <WalletErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Wallet connection failed" />
      </WalletErrorBoundary>
    );

    expect(screen.getByText('Wallet Connection Error')).toBeInTheDocument();
    expect(screen.getByText(/We encountered an issue connecting to your wallet/)).toBeInTheDocument();
  });

  it('shows Try Again and Refresh Page buttons', () => {
    render(
      <WalletErrorBoundary>
        <ThrowError shouldThrow={true} />
      </WalletErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Refresh Page')).toBeInTheDocument();
  });

  it('resets error state when Try Again is clicked', () => {
    const { rerender } = render(
      <WalletErrorBoundary>
        <ThrowError shouldThrow={true} />
      </WalletErrorBoundary>
    );

    // Error UI should be visible
    expect(screen.getByText('Wallet Error')).toBeInTheDocument();

    // Click Try Again
    fireEvent.click(screen.getByText('Try Again'));

    // Re-render with no error
    rerender(
      <WalletErrorBoundary>
        <ThrowError shouldThrow={false} />
      </WalletErrorBoundary>
    );

    // Should show normal content
    expect(screen.getByText('No error')).toBeInTheDocument();
  });
});
