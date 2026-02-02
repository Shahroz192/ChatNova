import React from 'react';
import { FileText } from 'lucide-react';

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
      <div className="sources-label d-flex align-items-center mb-2">
        <FileText size={14} className="me-2 text-muted" />
        <span className="small fw-bold text-muted text-uppercase" style={{ letterSpacing: '0.05em', fontSize: '10px' }}>Sources</span>
      </div>
      <div className="d-flex flex-wrap gap-2">
        {sources.map((source) => (
          <div key={source.id} className="source-item d-flex align-items-center px-2 py-1 bg-light border rounded-pill" style={{ fontSize: '11px' }}>
            <span className="me-1 fw-bold text-primary">[{source.id}]</span>
            <span className="text-secondary text-truncate" style={{ maxWidth: '150px' }}>{source.filename}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SourceList;
