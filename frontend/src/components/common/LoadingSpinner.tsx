import React from 'react';
import { Spinner } from '@phosphor-icons/react';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 24, 
  className = '', 
  text 
}) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Spinner 
        size={size} 
        className="animate-spin text-blue-500 dark:text-blue-400" 
      />
      {text && (
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
          {text}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;
