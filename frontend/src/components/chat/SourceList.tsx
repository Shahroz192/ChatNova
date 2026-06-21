import React from 'react';
import { FileText } from '@phosphor-icons/react';

interface Source {
  id: number;
  filename: string;
}

interface SourceListProps {
  sources: Source[];
}

const SourceList: React.FC<SourceListProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="sources-container mt-3 pt-2 border-top">
      <div className="sources-label flex items-center mb-2">
        <FileText size={14} className="mr-2 text-gray-500" />
        <span className="text-xs font-bold text-gray-500 uppercase" style={{ letterSpacing: '0.05em' }}>Sources</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <div key={source.id} className="source-item flex items-center px-2 py-1 bg-gray-100 border rounded-full" style={{ fontSize: '11px' }}>
            <span className="mr-1 font-bold text-gray-900 dark:text-gray-100">[{source.id}]</span>
            <span className="text-gray-500 dark:text-gray-400 truncate" style={{ maxWidth: '150px' }}>{source.filename}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SourceList;
