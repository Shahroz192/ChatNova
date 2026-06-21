import React from 'react';

interface SkeletonMessageProps {
  type: 'user' | 'assistant';
  darkMode: boolean;
}

const SkeletonMessage: React.FC<SkeletonMessageProps> = ({ type, darkMode }) => {
  const isUser = type === 'user';

  return (
    <div className={`flex justify-${isUser ? 'end' : 'start'} mb-2`}>
      <div className="flex flex-col items-end" style={{ maxWidth: isUser ? '70%' : '100%' }}>
        <div
          className={`skeleton-message ${isUser ? 'skeleton-user' : 'skeleton-assistant'} ${
            darkMode ? 'dark' : ''
          }`}
          style={{
            width: isUser ? '60%' : '80%',
            minWidth: '200px',
            height: '48px',
            borderRadius: isUser ? 'var(--radius-xl) var(--radius-xl) 4px var(--radius-xl)' : 'var(--radius-xl) var(--radius-xl) var(--radius-xl) 4px',
          }}
        >
          <div className="skeleton-content">
            <div className="skeleton-line" style={{ width: '80%' }}></div>
            <div className="skeleton-line" style={{ width: '60%' }}></div>
          </div>
        </div>
        <div className="skeleton-timestamp mt-1 mr-2"></div>
      </div>
    </div>
  );
};

export default SkeletonMessage;
