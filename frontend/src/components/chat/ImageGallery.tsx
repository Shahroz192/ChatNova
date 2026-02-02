import React, { useState, useCallback, useMemo } from 'react';
import { Modal, Button } from 'react-bootstrap';
import {
    ExternalLink,
    Download,
    Share2,
    Maximize2,
    Grid3X3,
    List,
    SortAsc,
    SortDesc
} from 'lucide-react';
import type { ImageGalleryData } from '../../types/search';

interface ImageGalleryProps {
    data: ImageGalleryData;
    onImageClick?: (image: ImageGalleryData['images'][0], index: number) => void;
    onImageShare?: (image: ImageGalleryData['images'][0]) => void;
    layout?: 'grid' | 'masonry' | 'carousel';
    columns?: number;
    showControls?: boolean;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
    data,
    onImageClick,
    onImageShare,
    columns = 3,
    showControls = true
}) => {
    const [selectedImage, setSelectedImage] = useState<ImageGalleryData['images'][0] | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());

    const handleImageClick = useCallback((image: ImageGalleryData['images'][0], index: number) => {
        setSelectedImage(image);
        onImageClick?.(image, index);
    }, [onImageClick]);

    const handleImageSelect = useCallback((index: number) => {
        setSelectedImages(prev => {
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
        setSelectedImages(prev => {
            if (prev.size === data.images.length) {
                return new Set();
            } else {
                return new Set(data.images.map((_, i) => i));
            }
        });
    }, [data.images.length]);

    const handleDownload = useCallback((image: ImageGalleryData['images'][0]) => {
        const link = document.createElement('a');
        link.href = image.src;
        link.download = image.alt || 'image';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    const handleShare = useCallback(async (image: ImageGalleryData['images'][0]) => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: image.title || image.alt,
                    text: `Check out this image: ${image.title || image.alt}`,
                    url: image.url || image.src,
                });
            } catch (error) {
                // Fallback to copying URL
                navigator.clipboard.writeText(image.url || image.src);
            }
        } else {
            navigator.clipboard.writeText(image.url || image.src);
        }
        onImageShare?.(image);
    }, [onImageShare]);

    const gridClass = useMemo(() => {
        if (viewMode === 'list') return 'image-gallery-list';

        switch (columns) {
            case 2: return 'image-gallery-grid-2';
            case 4: return 'image-gallery-grid-4';
            case 6: return 'image-gallery-grid-6';
            default: return 'image-gallery-grid-3';
        }
    }, [viewMode, columns]);

    const toggleSortOrder = useCallback(() => {
        setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    }, []);

    const handleDownloadSelected = useCallback(() => {
        selectedImages.forEach(index => {
            const image = data.images[index];
            if (image) handleDownload(image);
        });
    }, [selectedImages, data.images, handleDownload]);

    const handleCloseModal = useCallback(() => setSelectedImage(null), []);

    const renderImageCard = (image: ImageGalleryData['images'][0], index: number) => (
        <div
            key={index}
            className={`image-gallery-item ${viewMode === 'list' ? 'image-gallery-item-list' : ''}`}
        >
            <div className="image-gallery-card">
                <div className="image-gallery-image-container">
                    <img
                        src={image.src}
                        alt={image.alt}
                        className="image-gallery-image"
                        loading="lazy"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />

                    {/* Overlay controls */}
                    <div className="image-gallery-overlay">
                        <div className="image-gallery-actions">
                            <Button
                                variant="light"
                                size="sm"
                                className="image-gallery-action-btn"
                                onClick={() => handleImageClick(image, index)}
                                title="View full size"
                            >
                                <Maximize2 size={16} />
                            </Button>

                            <Button
                                variant="light"
                                size="sm"
                                className="image-gallery-action-btn"
                                onClick={() => handleDownload(image)}
                                title="Download"
                            >
                                <Download size={16} />
                            </Button>

                            <Button
                                variant="light"
                                size="sm"
                                className="image-gallery-action-btn"
                                onClick={() => handleShare(image)}
                                title="Share"
                            >
                                <Share2 size={16} />
                            </Button>
                        </div>
                    </div>

                    {/* Selection checkbox */}
                    {showControls ? (
                        <div className="image-gallery-select">
                            <input
                                type="checkbox"
                                checked={selectedImages.has(index)}
                                onChange={() => handleImageSelect(index)}
                                className="form-check-input"
                            />
                        </div>
                    ) : null}
                </div>

                {/* Image info */}
                {(image.title || image.alt || image.source) ? (
                    <div className="image-gallery-info">
                        {image.title ? (
                            <h6 className="image-gallery-title">{image.title}</h6>
                        ) : null}
                        {image.alt && !image.title ? (
                            <p className="image-gallery-alt">{image.alt}</p>
                        ) : null}
                        {image.source ? (
                            <div className="image-gallery-source">
                                <span className="badge bg-secondary image-gallery-source-badge">
                                    {image.source}
                                </span>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );

    return (
        <div className="image-gallery-container">
            {/* Header */}
            <div className="image-gallery-header mb-3">
                <div className="d-flex justify-content-between align-items-start">
                    <div>
                        {data.title ? (
                            <h5 className="image-gallery-title-main mb-1">{data.title}</h5>
                        ) : null}
                        <p className="text-muted mb-0">
                            {data.images.length} images
                            {data.total_count && data.total_count !== data.images.length ? (
                                ` of ${data.total_count}`
                            ) : null}
                        </p>
                    </div>

                    {showControls ? (
                        <div className="image-gallery-controls d-flex gap-2">
                            {/* View mode toggle */}
                            <div className="btn-group" role="group">
                                <Button
                                    variant={viewMode === 'grid' ? 'primary' : 'outline-secondary'}
                                    size="sm"
                                    onClick={() => setViewMode('grid')}
                                    title="Grid view"
                                >
                                    <Grid3X3 size={16} />
                                </Button>
                                <Button
                                    variant={viewMode === 'list' ? 'primary' : 'outline-secondary'}
                                    size="sm"
                                    onClick={() => setViewMode('list')}
                                    title="List view"
                                >
                                    <List size={16} />
                                </Button>
                            </div>

                            {/* Sort toggle */}
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={toggleSortOrder}
                                title="Sort images"
                            >
                                {sortOrder === 'desc' ? <SortDesc size={16} /> : <SortAsc size={16} />}
                            </Button>
                        </div>
                    ) : null}
                </div>

                {/* Bulk actions */}
                {selectedImages.size > 0 ? (
                    <div className="image-gallery-bulk-actions mt-3">
                        <div className="d-flex justify-content-between align-items-center">
                            <span className="text-muted">
                                {selectedImages.size} image{selectedImages.size !== 1 ? 's' : ''} selected
                            </span>
                            <div className="d-flex gap-2">
                                <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={handleDownloadSelected}
                                >
                                    Download Selected
                                </Button>
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={handleSelectAll}
                                >
                                    {selectedImages.size === data.images.length ? 'Deselect All' : 'Select All'}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Gallery */}
            <div className={`image-gallery ${gridClass}`}>
                {data.images.length === 0 ? (
                    <div className="no-images text-center py-5">
                        <div className="mb-3">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-muted">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21,15 16,10 5,21"></polyline>
                            </svg>
                        </div>
                        <h5 className="text-muted">No images found</h5>
                        <p className="text-muted">Try adjusting your search query</p>
                    </div>
                ) : (
                    data.images.map((image, index) => renderImageCard(image, index))
                )}
            </div>

            {/* Full-size image modal */}
            {selectedImage ? (
                <Modal
                    show={!!selectedImage}
                    onHide={handleCloseModal}
                    size="xl"
                    centered
                    className="image-gallery-modal"
                >
                    <Modal.Header closeButton>
                        <Modal.Title>
                            {selectedImage.title || selectedImage.alt}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="text-center">
                        <img
                            src={selectedImage.src}
                            alt={selectedImage.alt}
                            className="img-fluid"
                            style={{ maxHeight: '70vh', objectFit: 'contain' }}
                        />
                        {selectedImage.alt ? (
                            <p className="text-muted mt-2">{selectedImage.alt}</p>
                        ) : null}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            variant="outline-secondary"
                            onClick={() => handleDownload(selectedImage)}
                        >
                            <Download size={16} className="me-2" />
                            Download
                        </Button>
                        <Button
                            variant="outline-secondary"
                            onClick={() => handleShare(selectedImage)}
                        >
                            <Share2 size={16} className="me-2" />
                            Share
                        </Button>
                        {selectedImage.url ? (
                            <Button
                                variant="primary"
                                onClick={() => window.open(selectedImage.url, '_blank')}
                            >
                                <ExternalLink size={16} className="me-2" />
                                View Original
                            </Button>
                        ) : null}
                    </Modal.Footer>
                </Modal>
            ) : null}
        </div>
    );
};

export default React.memo(ImageGallery);