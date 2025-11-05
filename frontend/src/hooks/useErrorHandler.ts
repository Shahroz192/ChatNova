import { useState, useCallback, useEffect } from 'react';

export interface ErrorContext {
  type: 'network' | 'validation' | 'ai_service' | 'auth' | 'general' | 'user_input';
  message: string;
  details?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recovery?: {
    action: () => void;
    label: string;
    description?: string;
  };
  retry?: () => void;
  canRetry?: boolean;
  timestamp: number;
}

export interface ErrorState {
  currentError: ErrorContext | null;
  errorHistory: ErrorContext[];
  isRetrying: boolean;
}

export interface ErrorActions {
  showError: (error: Omit<ErrorContext, 'timestamp'> | string) => void;
  showNetworkError: (message?: string) => void;
  showValidationError: (message: string) => void;
  showAIError: (message: string, retry?: () => void) => void;
  showAuthError: (message: string) => void;
  showUserError: (message: string) => void;
  clearError: () => void;
  retryLastOperation: () => void;
  clearHistory: () => void;
}

/**
 * Enhanced error handling hook with recovery options and context
 */
export const useErrorHandler = (): ErrorState & ErrorActions => {
  const [errorState, setErrorState] = useState<ErrorState>({
    currentError: null,
    errorHistory: [],
    isRetrying: false
  });

  const createErrorContext = useCallback((
    error: Omit<ErrorContext, 'timestamp'>
  ): ErrorContext => {
    return {
      ...error,
      timestamp: Date.now()
    };
  }, []);

  const showError = useCallback((error: Omit<ErrorContext, 'timestamp'> | string) => {
    const errorContext = typeof error === 'string' 
      ? createErrorContext({
          type: 'general',
          message: error,
          severity: 'medium'
        })
      : createErrorContext(error);

    setErrorState(prev => ({
      ...prev,
      currentError: errorContext,
      errorHistory: [errorContext, ...prev.errorHistory.slice(0, 9)] // Keep last 10 errors
    }));
  }, [createErrorContext]);

  const showNetworkError = useCallback((message: string = 'Network connection failed. Please check your internet connection.') => {
    showError({
      type: 'network',
      message,
      severity: 'high',
      recovery: {
        action: () => window.location.reload(),
        label: 'Reload Page',
        description: 'Try reloading the page to reconnect'
      }
    });
  }, [showError]);

  const showValidationError = useCallback((message: string) => {
    showError({
      type: 'validation',
      message,
      severity: 'low'
    });
  }, [showError]);

  const showAIError = useCallback((message: string, retry?: () => void) => {
    showError({
      type: 'ai_service',
      message,
      severity: 'medium',
      recovery: retry ? {
        action: retry,
        label: 'Retry Request',
        description: 'Try sending the request again'
      } : undefined,
      retry,
      canRetry: !!retry
    });
  }, [showError]);

  const showAuthError = useCallback((message: string = 'Authentication failed. Please log in again.') => {
    showError({
      type: 'auth',
      message,
      severity: 'high',
      recovery: {
        action: () => window.location.href = '/login',
        label: 'Go to Login',
        description: 'Redirect to login page'
      }
    });
  }, [showError]);

  const showUserError = useCallback((message: string) => {
    showError({
      type: 'user_input',
      message,
      severity: 'low'
    });
  }, [showError]);

  const clearError = useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      currentError: null
    }));
  }, []);

  const retryLastOperation = useCallback(() => {
    if (errorState.currentError?.retry) {
      setErrorState(prev => ({ ...prev, isRetrying: true }));
      
      try {
        errorState.currentError.retry!();
      } catch (error) {
        showError({
          type: 'general',
          message: 'Retry failed. Please try again manually.',
          severity: 'medium'
        });
      } finally {
        setErrorState(prev => ({ ...prev, isRetrying: false }));
        clearError();
      }
    }
  }, [errorState.currentError, showError, clearError]);

  const clearHistory = useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      errorHistory: []
    }));
  }, []);

  return {
    ...errorState,
    showError,
    showNetworkError,
    showValidationError,
    showAIError,
    showAuthError,
    showUserError,
    clearError,
    retryLastOperation,
    clearHistory
  };
};

/**
 * Network status hook for offline/online detection with transition tracking
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showConnectionRestored, setShowConnectionRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowConnectionRestored(true);
      // Auto-hide after 3 seconds
      setTimeout(() => setShowConnectionRestored(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowConnectionRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, showConnectionRestored };
};

/**
 * API error handling utility
 */
export const handleApiError = async (
  response: Response,
  errorHandler: ReturnType<typeof useErrorHandler>
): Promise<void> => {
  let message = 'An unexpected error occurred';
  
  try {
    const errorData = await response.json();
    message = errorData.detail || errorData.message || message;
  } catch {
    // If can't parse JSON, use status text
    message = response.statusText || message;
  }

  switch (response.status) {
    case 401:
      errorHandler.showAuthError('Authentication failed. Please log in again.');
      break;
    case 403:
      errorHandler.showError({
        type: 'auth',
        message: 'You do not have permission to perform this action.',
        severity: 'high'
      });
      break;
    case 404:
      errorHandler.showError({
        type: 'general',
        message: 'The requested resource was not found.',
        severity: 'medium'
      });
      break;
    case 429:
      errorHandler.showError({
        type: 'general',
        message: 'Too many requests. Please wait a moment and try again.',
        severity: 'medium'
      });
      break;
    case 500:
      errorHandler.showError({
        type: 'general',
        message: 'Server error. Please try again later.',
        severity: 'high'
      });
      break;
    default:
      errorHandler.showError({
        type: 'general',
        message,
        severity: 'medium'
      });
  }
};

/**
 * Retry utility with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff: baseDelay * 2^attempt
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};
