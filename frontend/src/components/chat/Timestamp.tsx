import React, { useState } from 'react';
import { formatRelativeTime, formatFullDateTime } from '../../utils/time';

interface TimestampProps {
  dateString: string;
  className?: string;
}

const Timestamp: React.FC<TimestampProps> = ({ dateString, className = '' }) => {
  const [showFullTime, setShowFullTime] = useState(false);

  return (
    <small
      className={`text-muted timestamp ${className}`}
      onMouseEnter={() => setShowFullTime(true)}
      onMouseLeave={() => setShowFullTime(false)}
      style={{ cursor: 'default', fontSize: '0.75rem' }}
      title={formatFullDateTime(dateString)} // Fallback for accessibility
    >
      {showFullTime ? formatFullDateTime(dateString) : formatRelativeTime(dateString)}
    </small>
  );
};

export default Timestamp;
