import React from 'react';

interface SkeletonMessageProps {
  type: 'user' | 'assistant';
  darkMode: boolean;
}

const SkeletonMessage: React.FC<SkeletonMessageProps> = ({ type, darkMode }) => {
  const isUser = type === 'user';

  return (
    <div className={`d-flex justify-content-${isUser ? 'end' : 'start'} mb-2`}>
      <div className="d-flex flex-column align-items-end" style={{ maxWidth: isUser ? '70%' : '100%' }}>
        <div
          className={`skeleton-message ${isUser ? 'skeleton-user' : 'skeleton-assistant'} ${
            darkMode ? 'dark' : ''
          }`}
          style={{
            width: isUser ? '60%' : '80%',
            minWidth: '200px',
            height: '48px',
            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          }}
        >
          <div className="skeleton-content">
            <div className="skeleton-line" style={{ width: '80%' }}></div>
            <div className="skeleton-line" style={{ width: '60%' }}></div>
          </div>
        </div>
        <div className="skeleton-timestamp mt-1 me-2"></div>
      </div>
    </div>
  );
};

export default SkeletonMessage;
