import React, { useState, useCallback } from 'react';
import { Card, Button, Pagination } from 'react-bootstrap';
import {
  ExternalLink,
  Share2,
  SortAsc,
  SortDesc
} from 'lucide-react';
import type { SearchResultData, SearchControlsData } from '../../types/search';

interface SearchResultsProps {
  results: SearchResultData[];
  searchQuery: string;
  totalResults?: number;
  searchTimeMs?: number;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onResultClick?: (result: SearchResultData) => void;
  onShareResult?: (result: SearchResultData) => void;
  controls?: SearchControlsData;
  onControlChange?: (controlId: string, value: string) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  searchQuery,
  totalResults,
  searchTimeMs,
  currentPage = 1,
  totalPages,
  onPageChange,
  onResultClick,
  onShareResult,
  controls,
  onControlChange
}) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());

  const handleSort = useCallback(() => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  const handleResultSelect = useCallback((index: number) => {
    setSelectedResults(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedResults(prev => {
      if (prev.size === results.length) {
        return new Set();
      } else {
        return new Set(results.map((_, i) => i));
      }
    });
  }, [results]);


  const formatTime = useCallback((ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }, []);

  return (
    <div className="search-results-container">
      {/* Header */}
      <div className="search-results-header mb-4">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h3 className="search-results-title mb-1">
              Search Results for "{searchQuery}"
            </h3>
            <div className="search-results-meta">
              {totalResults && (
                <span className="text-muted me-3">
                  {totalResults.toLocaleString()} results
                </span>
              )}
              {searchTimeMs && (
                <span className="text-muted me-3">
                  {formatTime(searchTimeMs)}
                </span>
              )}
              <span className="badge bg-info ms-2">
                Page {currentPage}
                {totalPages && ` of ${totalPages}`}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleSort}
              title="Sort by relevance"
            >
              {sortOrder === 'desc' ? <SortDesc size={16} /> : <SortAsc size={16} />}
            </Button>

          </div>
        </div>

        {/* Search Controls */}
        {controls && (
          <div className="search-controls mb-3">
            {controls.search_types && (
              <div className="control-group mb-2">
                <label className="control-label">Search Type:</label>
                <div className="d-flex gap-2 flex-wrap">
                  {controls.search_types.map((type) => (
                    <Button
                      key={type.id}
                      variant={type.active ? "primary" : "outline-secondary"}
                      size="sm"
                      onClick={() => onControlChange?.('search_type', type.id)}
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bulk actions */}
        {results.length > 0 && (
          <div className="bulk-actions mb-3">
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedResults.size === results.length && results.length > 0}
                  onChange={handleSelectAll}
                  className="form-check-input"
                />
                <span className="text-muted">
                  {selectedResults.size > 0
                    ? `${selectedResults.size} selected`
                    : 'Select all results'
                  }
                </span>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="search-results-list">
        {results.length === 0 ? (
          <div className="no-results text-center py-5">
            <div className="mb-3">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-muted">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <h5 className="text-muted">No results found</h5>
            <p className="text-muted">Try adjusting your search query or filters</p>
          </div>
        ) : (
          results.map((result, index) => (
            <Card key={index} className="search-result-item mb-3">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="form-check me-3">
                    <input
                      type="checkbox"
                      checked={selectedResults.has(index)}
                      onChange={() => handleResultSelect(index)}
                      className="form-check-input"
                    />
                  </div>

                  <div className="flex-grow-1">
                    <h5 className="search-result-title mb-2">
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onResultClick?.(result)}
                        className="text-decoration-none"
                      >
                        {result.title}
                        <ExternalLink size={16} className="ms-2" />
                      </a>
                    </h5>

                    <p className="search-result-snippet text-muted mb-2">
                      {result.snippet}
                    </p>

                    <div className="search-result-meta d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center gap-2">
                        <span className="search-result-source text-muted small">
                          {result.source}
                        </span>
                        {result.relevance_score && (
                          <span className="badge bg-success relevance-badge">
                            {(result.relevance_score * 100).toFixed(0)}% match
                          </span>
                        )}
                        {result.content_type && (
                          <span className="badge bg-info content-type-badge">
                            {result.content_type}
                          </span>
                        )}
                      </div>

                      <div className="search-result-actions d-flex gap-1">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => onShareResult?.(result)}
                          title="Share result"
                        >
                          <Share2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages && totalPages > 1 && (
        <div className="search-pagination mt-4">
          <Pagination className="justify-content-center">
            <Pagination.Prev
              disabled={currentPage <= 1}
              onClick={() => onPageChange?.(currentPage - 1)}
            />

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <Pagination.Item
                  key={pageNum}
                  active={pageNum === currentPage}
                  onClick={() => onPageChange?.(pageNum)}
                >
                  {pageNum}
                </Pagination.Item>
              );
            })}

            <Pagination.Next
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange?.(currentPage + 1)}
            />
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default React.memo(SearchResults);