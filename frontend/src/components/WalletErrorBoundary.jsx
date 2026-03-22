// frontend/src/components/WalletErrorBoundary.jsx
import React from 'react';

/**
 * Specialized Error Boundary for wallet-related components
 * Provides wallet-specific error messages and recovery options
 */
class WalletErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('WalletErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Optional: Send to error reporting service
    // Example: logErrorToService(error, errorInfo, { context: 'wallet' });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <WalletErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Wallet-specific error fallback UI
 */
function WalletErrorFallback({ error, onRetry }) {
  // Determine if this is a wallet connection error
  const isWalletConnectionError = error?.message?.toLowerCase().includes('wallet') ||
                                   error?.message?.toLowerCase().includes('connection');

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-red-200">
      <div className="flex items-start">
        {/* Error Icon */}
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Content */}
        <div className="ml-3 flex-1">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {isWalletConnectionError ? 'Wallet Connection Error' : 'Wallet Error'}
          </h3>
          
          <p className="text-sm text-gray-600 mb-4">
            {isWalletConnectionError
              ? 'We encountered an issue connecting to your wallet. Please make sure your wallet is unlocked and try again.'
              : 'An error occurred while processing your wallet request. Please try again.'}
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Try Again
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Refresh Page
            </button>
          </div>

          {/* Development Mode: Show Error Details */}
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                Error Details (Development Only)
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 text-xs">
                <p className="font-mono text-red-600 mb-2">
                  {error.toString()}
                </p>
                {error.stack && (
                  <pre className="overflow-auto text-gray-700 max-h-40">
                    {error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export default WalletErrorBoundary;
