import React from 'react';
import { Card, Button } from 'react-bootstrap';
import { ExternalLink, Share2, Clock, Tag } from 'lucide-react';
import type { NewsArticleData } from '../../types/search';

interface NewsCardProps {
    article: NewsArticleData;
    onShare?: (article: NewsArticleData) => void;
    onReadMore?: (article: NewsArticleData) => void;
    compact?: boolean;
    showActions?: boolean;
}

const NewsCard: React.FC<NewsCardProps> = ({
    article,
    onShare,
    onReadMore,
    compact = false,
    showActions = true
}) => {
    const formatTimestamp = (timestamp: string) => {
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);

            if (diffHours < 1) return 'Just now';
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString();
        } catch {
            return 'Unknown';
        }
    };

    const handleShare = async () => {
        if (navigator.share && onShare) {
            try {
                await navigator.share({
                    title: article.title,
                    text: article.snippet,
                    url: article.source_url,
                });
                onShare(article);
            } catch (error) {
                // Fallback to copying URL
                navigator.clipboard.writeText(article.source_url);
            }
        } else if (onShare) {
            onShare(article);
        }
    };

    if (compact) {
        return (
            <Card className="news-card news-card-compact mb-2">
                <Card.Body className="p-3">
                    <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1 me-3">
                            <h6 className="news-card-title-compact mb-1">
                                <a
                                    href={article.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-decoration-none"
                                >
                                    {article.title}
                                </a>
                            </h6>
                            <p className="news-card-snippet-compact text-muted small mb-1">
                                {article.snippet}
                            </p>
                            <div className="news-card-meta-compact d-flex align-items-center gap-2">
                                <span className="text-muted small">{article.source_name}</span>
                                <span className="text-muted small">•</span>
                                <span className="text-muted small">{formatTimestamp(article.timestamp)}</span>
                            </div>
                        </div>

                        {showActions && (
                            <div className="d-flex gap-1">
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={handleShare}
                                    title="Share article"
                                >
                                    <Share2 size={14} />
                                </Button>
                            </div>
                        )}
                    </div>
                </Card.Body>
            </Card>
        );
    }

    return (
        <Card className="news-card h-100">
            {/* Article thumbnail */}
            {article.thumbnail && (
                <div className="news-card-thumbnail">
                    <img
                        src={article.thumbnail}
                        alt={article.title}
                        className="news-card-image"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>
            )}

            <Card.Body className="d-flex flex-column">
                <div className="news-card-content flex-grow-1">
                    <h5 className="news-card-title mb-2">
                        <a
                            href={article.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-decoration-none"
                        >
                            {article.title}
                            <ExternalLink size={16} className="ms-2" />
                        </a>
                    </h5>

                    <p className="news-card-snippet text-muted mb-3">
                        {article.snippet}
                    </p>

                    {/* Article metadata */}
                    <div className="news-card-meta mb-3">
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <span className="news-card-source fw-medium">{article.source_name}</span>
                            <span className="text-muted">•</span>
                            <div className="d-flex align-items-center gap-1 text-muted small">
                                <Clock size={14} />
                                {formatTimestamp(article.timestamp)}
                            </div>
                        </div>

                        {/* Tags */}
                        {article.tags && article.tags.length > 0 && (
                            <div className="d-flex flex-wrap gap-1">
                                {article.tags.slice(0, 5).map((tag, index) => (
                                    <span
                                        key={index}
                                        className="badge bg-secondary news-card-tag"
                                    >
                                        <Tag size={10} className="me-1" />
                                        {tag}
                                    </span>
                                ))}
                                {article.tags.length > 5 && (
                                    <span className="text-muted small">
                                        +{article.tags.length - 5} more
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {showActions && (
                    <div className="news-card-actions mt-auto">
                        <div className="d-flex justify-content-between align-items-center">
                            <div className="d-flex gap-2">
                                <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={() => onReadMore?.(article)}
                                >
                                    Read More
                                </Button>
                            </div>

                            <div className="d-flex gap-1">
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={handleShare}
                                    title="Share article"
                                >
                                    <Share2 size={14} />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Card.Body>

            {/* Footer with additional info */}
            <Card.Footer className="news-card-footer bg-transparent border-0 pt-0">
                <div className="d-flex justify-content-between align-items-center text-muted small">
                    <span>
                        {article.content && (
                            <span className="badge bg-info me-2">
                                Article
                            </span>
                        )}
                    </span>
                    <span>
                        <a
                            href={article.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted text-decoration-none"
                        >
                            View Original
                            <ExternalLink size={12} className="ms-1" />
                        </a>
                    </span>
                </div>
            </Card.Footer>
        </Card>
    );
};

export default NewsCard;