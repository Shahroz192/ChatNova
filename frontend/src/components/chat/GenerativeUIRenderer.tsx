import React, { useState, useCallback } from 'react';
import type { UIContainer, UIComponent, ChartData } from '../../types/generative-ui';
import type { ImageGalleryData } from '../../types/search';
import ChartRenderer from './ChartRenderer';
import SearchResults from './SearchResults';
import NewsCard from './NewsCard';
import ImageGallery from './ImageGallery';
import MarkdownRenderer from './MarkdownRenderer';
import { useToast } from '../../contexts/ToastContext';
import '../../styles/GenerativeUI.css';

interface RendererProps {
    data: UIContainer | null;
}

const SlidesWrapper = React.memo(({ children }: { children?: React.ReactNode }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const kids = React.Children.toArray(children);

    if (kids.length === 0) return null;

    const nextSlide = useCallback(() => setCurrentIndex((prev) => (prev + 1) % kids.length), [kids.length]);
    const prevSlide = useCallback(() => setCurrentIndex((prev) => (prev - 1 + kids.length) % kids.length), [kids.length]);

    const goToSlide = useCallback((idx: number) => {
        setCurrentIndex(idx);
    }, []);

    return (
        <div className="gen-ui-slides-container">
            <div className="gen-ui-slides-header">
                <span className="gen-ui-label" style={{ marginBottom: 0 }}>Slide {currentIndex + 1} of {kids.length}</span>
                <div className="flex gap-2">
                    <button onClick={prevSlide} className="gen-ui-slide-nav-btn" aria-label="Previous slide">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button onClick={nextSlide} className="gen-ui-slide-nav-btn" aria-label="Next slide">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>
            <div className="gen-ui-slide-content">
                {kids[currentIndex]}
            </div>
            <div className="flex justify-center gap-1.5 pb-4">
                {kids.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => goToSlide(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-primary w-4' : 'bg-secondary'}`}
                        style={{ height: '8px', width: idx === currentIndex ? '16px' : '8px', borderRadius: '4px', border: 'none', backgroundColor: idx === currentIndex ? 'var(--accent)' : 'var(--border-dark)' }}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
});

const widthClasses: Record<string, string> = {
    'full': 'gen-ui-wrapper-full',
    '1/2': 'gen-ui-wrapper-half',
    '1/3': 'gen-ui-wrapper-third',
    '2/3': 'gen-ui-wrapper-two-thirds',
    '1/4': 'gen-ui-wrapper-quarter', /* Fallback to CSS definition if needed or just use style */
    '3/4': 'gen-ui-wrapper-three-quarters',
    'undefined': 'gen-ui-wrapper-full'
};

interface WrapperProps {
    children?: React.ReactNode;
    width?: string;
}

const ComponentWrapper: React.FC<WrapperProps> = React.memo(({ children, width }) => {
    const widthClass = width ? widthClasses[width] || 'gen-ui-wrapper-full' : 'gen-ui-wrapper-full';
    return (
        <div className={widthClass}>
            {children}
        </div>
    );
});

const GenerativeUIRenderer: React.FC<RendererProps> = ({ data }) => {
    const { success, error: toastError } = useToast();
    
    if (!data) return null;

    const handleShare = async (title: string, text: string, url: string) => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title,
                    text,
                    url,
                });
                success('Shared successfully');
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    // Fallback to clipboard if share fails
                    try {
                        await navigator.clipboard.writeText(url);
                        success('Link copied to clipboard');
                    } catch (clipErr) {
                        toastError('Failed to share or copy link');
                    }
                }
            }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                success('Link copied to clipboard');
            } catch (clipErr) {
                toastError('Failed to copy link');
            }
        }
    };

    const renderChart = (props: UIComponent['props']) => {
        if (!props) return null;

        const { chartType, data: chartData, label } = props;

        if (!chartType || !['bar', 'line', 'pie'].includes(chartType)) {
            return (
                <div className="gen-ui-alert gen-ui-alert-warning">
                    Invalid chart type: {chartType || 'missing'}
                </div>
            );
        }

        let processedData = chartData;
        if (typeof chartData === 'string') {
            try {
                processedData = JSON.parse(chartData);
            } catch (e) {
                processedData = [];
            }
        }

        const dataArray = Array.isArray(processedData) ? processedData : [];
        if (dataArray.length === 0) {
            return (
                <div className="gen-ui-alert gen-ui-alert-info">
                    No chart data generated
                </div>
            );
        }

        const safeChartData: ChartData[] = dataArray.map((item, index) => {
            const value = typeof item.value === 'number' ? item.value : 0;
            const name = typeof item.name === 'string' ? item.name : String(index);

            return {
                name,
                value,
                category: item.category,
                color: item.color
            };
        });

        return (
            <div className="gen-ui-chart-container">
                <ChartRenderer
                    type={chartType as 'bar' | 'line' | 'pie'}
                    data={safeChartData}
                    label={label || 'Chart'}
                />
            </div>
        );
    };

    const renderSearchResults = (props: any) => {
        const { results, search_query, total_results, search_time_ms, pagination } = props;

        if (!Array.isArray(results)) {
            return <div className="gen-ui-text-label" style={{fontStyle: 'italic', color: 'var(--text-tertiary)'}}>No search results available</div>;
        }

        return (
            <SearchResults
                results={results}
                searchQuery={search_query}
                totalResults={total_results}
                searchTimeMs={search_time_ms}
                currentPage={pagination?.current_page}
                totalPages={pagination?.total_pages}
                onResultClick={(result) => window.open(result.url, '_blank')}
                onShareResult={(result) => handleShare(result.title, result.snippet, result.url)}
            />
        );
    };

    const renderNewsCard = (props: any) => {
        const { title, source_url, snippet, source_name, timestamp, tags, actions, thumbnail } = props;

        return (
            <NewsCard
                article={{
                    title,
                    source_url,
                    snippet,
                    source_name,
                    timestamp,
                    tags,
                    actions,
                    thumbnail
                }}
                onShare={(article) => handleShare(article.title, article.snippet, article.source_url)}
                onReadMore={(article) => window.open(article.source_url, '_blank')}
            />
        );
    };

    const renderImageGallery = (props: any) => {
        const { images, title, total_count } = props;

        if (!Array.isArray(images)) {
            return <div className="gen-ui-text-label" style={{fontStyle: 'italic', color: 'var(--text-tertiary)'}}>No images available</div>;
        }

        const galleryData: ImageGalleryData = {
            images: images.map((img: any) => ({
                src: img.src || img.url,
                thumbnail: img.thumbnail || img.src || img.url,
                alt: img.alt || img.title || 'Image',
                title: img.title,
                source: img.source,
                url: img.url
            })),
            title,
            total_count
        };

        return (
            <ImageGallery
                data={galleryData}
                onImageClick={(image, index) => console.log('Image clicked:', image, index)}
                onImageShare={(image) => handleShare(image.title || image.alt, `Check out this image: ${image.title || image.alt}`, image.url || image.src)}
            />
        );
    };

    const renderLoading = (props: any) => {
        const { label } = props;
        return (
            <div className="gen-ui-loading">
                <div className="gen-ui-spinner"></div>
                <span>{label || 'Loading...'}</span>
            </div>
        );
    };

    const renderError = (props: any) => {
        const { label, text, actions } = props;
        return (
            <div className="gen-ui-alert gen-ui-alert-error">
                <div className="flex-1">
                    <h3 style={{fontWeight: 'bold', marginBottom: '4px'}}>{label || 'Error'}</h3>
                    <p style={{fontSize: '0.9em'}}>{text}</p>
                    {actions && actions.length > 0 ? (
                        <div className="flex gap-2 mt-3">
                            {actions.map((action: string, index: number) => (
                                <button key={index} className="gen-ui-btn gen-ui-btn-secondary" style={{width: 'auto', padding: '4px 12px', fontSize: '0.8em'}}>
                                    {action.replace('_', ' ').toUpperCase()}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderComponent = (component: UIComponent, index: number, isNested: boolean = false) => {
        if (!component) return null;

        const type = component.type;
        const props = component.props || {};
        const key = `${type}-${index}`;
        const inputId = `generated-input-${isNested ? 'nested-' : ''}${index}`;
        const children = Array.isArray(props.children) ? props.children : [];

        try {
            switch (type) {
                case 'slides':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <SlidesWrapper>
                                {children.map((child, childIdx) => (
                                    <div key={`slide-${childIdx}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        {renderComponent(child, childIdx, true)}
                                    </div>
                                ))}
                            </SlidesWrapper>
                        </ComponentWrapper>
                    );

                case 'card':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className="gen-ui-card">
                                {props.label ? (
                                    <div className="gen-ui-card-header">
                                        {props.label}
                                    </div>
                                ) : null}
                                <div className="gen-ui-card-body">
                                    {children.map((child, childIdx) => renderComponent(child, childIdx, true))}
                                </div>
                            </div>
                        </ComponentWrapper>
                    );

                case 'row':
                    return (
                        <div key={key} className="gen-ui-row">
                            {children.map((child, childIdx) => renderComponent(child, childIdx, true))}
                        </div>
                    );

                case 'image':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className="flex flex-col items-center">
                                <div className="gen-ui-card" style={{ padding: '8px', alignItems: 'center' }}>
                                    <img
                                        src={props.src}
                                        alt={props.alt || props.label || 'Image'}
                                        style={{ maxHeight: '200px', objectFit: 'contain', width: '100%' }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                        }}
                                    />
                                    <div className="hidden h-32 w-32 flex items-center justify-center text-slate-400">
                                        Image Error
                                    </div>
                                </div>
                                {props.label ? <span className="gen-ui-label" style={{ marginTop: '8px' }}>{props.label}</span> : null}
                            </div>
                        </ComponentWrapper>
                    );

                case 'text':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className="gen-ui-text-container">
                                <MarkdownRenderer content={props.label || props.text || ''} />
                            </div>
                        </ComponentWrapper>
                    );

                case 'alert':
                    let alertClass = 'gen-ui-alert-info';
                    if (props.variant === 'success') alertClass = 'gen-ui-alert-success';
                    if (props.variant === 'warning') alertClass = 'gen-ui-alert-warning';
                    if (props.variant === 'error' || props.variant === 'danger') alertClass = 'gen-ui-alert-error';
                    
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className={`gen-ui-alert ${alertClass}`}>
                                <p className="font-medium" style={{ margin: 0 }}>{props.label}</p>
                            </div>
                        </ComponentWrapper>
                    );

                case 'search_results':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            {renderSearchResults(props)}
                        </ComponentWrapper>
                    );

                case 'news_card':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            {renderNewsCard(props)}
                        </ComponentWrapper>
                    );

                case 'image_gallery':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            {renderImageGallery(props)}
                        </ComponentWrapper>
                    );

                case 'loading':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            {renderLoading(props)}
                        </ComponentWrapper>
                    );

                case 'error':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            {renderError(props)}
                        </ComponentWrapper>
                    );

                case 'input':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor={inputId} className="gen-ui-label">
                                    {props.label}
                                </label>
                                <input
                                    id={inputId}
                                    type="text"
                                    placeholder={props.placeholder}
                                    className="gen-ui-input"
                                />
                            </div>
                        </ComponentWrapper>
                    );

                case 'textarea':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor={inputId} className="gen-ui-label">
                                    {props.label}
                                </label>
                                <textarea
                                    id={inputId}
                                    placeholder={props.placeholder}
                                    rows={3}
                                    className="gen-ui-textarea"
                                />
                            </div>
                        </ComponentWrapper>
                    );

                case 'table':
                    const rows = props.rows || [];
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className="gen-ui-table-container">
                                {props.label ? (
                                    <div className="gen-ui-card-header">
                                        {props.label}
                                    </div>
                                ) : null}
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="gen-ui-table">
                                        <thead>
                                            <tr>
                                                {props.headers?.map((head: any, hIdx: number) => (
                                                    <th key={hIdx}>{head}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row: any, rIdx: number) => (
                                                <tr key={rIdx}>
                                                    {row.map((cell: any, cIdx: number) => (
                                                        <td key={cIdx}>{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                            {rows.length === 0 ? (
                                                <tr><td colSpan={props.headers?.length || 1} style={{ textAlign: 'center', padding: '20px', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>No data generated</td></tr>
                                            ) : null}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </ComponentWrapper>
                    );

                case 'chart':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className="mt-2">
                                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 className="gen-ui-label" style={{ marginBottom: 0 }}>{props.label}</h3>
                                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{props.chartType}</span>
                                </div>
                                {renderChart(props)}
                            </div>
                        </ComponentWrapper>
                    );

                case 'button':
                     const btnVariant = props.variant || 'primary';
                     const btnClass = btnVariant === 'primary' ? 'gen-ui-btn-primary' : 'gen-ui-btn-secondary';

                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="mt-2">
                                 <button
                                     onClick={() => alert(`Clicked: ${props.label}`)}
                                     className={`gen-ui-btn ${btnClass}`}
                                 >
                                     {props.label}
                                 </button>
                             </div>
                         </ComponentWrapper>
                     );

                case 'checkbox':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="flex items-center gap-3">
                                 <input
                                     id={inputId}
                                     type="checkbox"
                                     defaultChecked={props.value === 'true' || props.value === true}
                                     style={{ width: '16px', height: '16px' }}
                                 />
                                 <label htmlFor={inputId} style={{ fontSize: '0.9em', color: 'var(--text-primary)' }}>
                                     {props.label}
                                 </label>
                             </div>
                         </ComponentWrapper>
                     );

                case 'radio':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <fieldset className="space-y-3">
                                 {props.label ? (
                                     <legend className="gen-ui-label">
                                         {props.label}
                                     </legend>
                                 ) : null}
                                 <div className="space-y-2">
                                     {Array.isArray(props.options) && props.options.map((option: any, idx: number) => (
                                         <div key={idx} className="flex items-center gap-3">
                                             <input
                                                 id={`radio-${inputId}-${idx}`}
                                                 type="radio"
                                                 name={props.name || `radio-${inputId}`}
                                                 value={option}
                                                 defaultChecked={props.value === option}
                                                 style={{ width: '16px', height: '16px' }}
                                             />
                                             <label htmlFor={`radio-${inputId}-${idx}`} style={{ fontSize: '0.9em', color: 'var(--text-primary)' }}>
                                                 {option}
                                             </label>
                                         </div>
                                     ))}
                                 </div>
                             </fieldset>
                         </ComponentWrapper>
                     );

                case 'select':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="flex flex-col gap-1.5">
                                 <label htmlFor={inputId} className="gen-ui-label">
                                     {props.label}
                                 </label>
                                 <select
                                     id={inputId}
                                     defaultValue={props.value || ''}
                                     className="gen-ui-select"
                                 >
                                     <option value="">{props.placeholder || 'Select an option'}</option>
                                     {Array.isArray(props.options) && props.options.map((option: any, idx: number) => (
                                         <option key={idx} value={option}>
                                             {option}
                                         </option>
                                     ))}
                                 </select>
                             </div>
                         </ComponentWrapper>
                     );

                case 'layout':
                case 'data':
                case 'content':
                case 'form':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className={props.variant === 'card' ? 'gen-ui-card' : ''} style={props.variant === 'card' ? { padding: '16px' } : {}}>
                                 {props.label ? (
                                     <h3 className="gen-ui-text-label" style={{ fontWeight: 'bold', marginBottom: '16px' }}>
                                         {props.label}
                                     </h3>
                                 ) : null}
                                 {Array.isArray(props.children) ? (
                                     <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                         {props.children.map((child: any, idx: number) => renderComponent(child, idx))}
                                     </div>
                                 ) : null}
                             </div>
                         </ComponentWrapper>
                     );

                case 'source_citation':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div style={{ fontSize: '0.75em', color: 'var(--text-secondary)', padding: '8px', border: '1px solid var(--border-light)', borderRadius: '4px', background: 'var(--bg-secondary)' }}>
                                 Source: <a href={props.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                                     {props.source_name || props.source_url}
                                 </a>
                                 {props.timestamp ? <span style={{ marginLeft: '8px', opacity: 0.7 }}>{new Date(props.timestamp).toLocaleDateString()}</span> : null}
                             </div>
                         </ComponentWrapper>
                     );

                case 'search_summary':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="gen-ui-alert gen-ui-alert-info">
                                 <div>
                                     <p style={{ margin: 0, fontSize: '0.9em' }}>
                                         <span style={{ fontWeight: 'bold' }}>{props.total_results || 0}</span> results found in <span style={{ fontWeight: 'bold' }}>{props.search_time_ms || 0}ms</span>
                                     </p>
                                     {props.summary ? <p style={{ margin: '4px 0 0 0', fontSize: '0.85em', opacity: 0.8 }}>{props.summary}</p> : null}
                                 </div>
                             </div>
                         </ComponentWrapper>
                     );

                case 'related_searches':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="space-y-2">
                                 {props.label ? (
                                     <h4 className="gen-ui-label">
                                         {props.label}
                                     </h4>
                                 ) : null}
                                 <div className="flex flex-wrap gap-2">
                                     {Array.isArray(props.searches) && props.searches.map((search: any, idx: number) => (
                                         <button
                                             key={idx}
                                             className="gen-ui-tag"
                                         >
                                             {search}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                         </ComponentWrapper>
                     );

                case 'search_controls':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="gen-ui-card" style={{ padding: '16px' }}>
                                 {props.label ? (
                                     <h4 className="gen-ui-label">
                                         {props.label}
                                     </h4>
                                 ) : null}
                                 <div className="space-y-3">
                                     {Array.isArray(props.filters) && props.filters.map((filter: any, fIdx: number) => (
                                         <div key={fIdx}>
                                             <label style={{ fontSize: '0.75em', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{filter.label}</label>
                                             <div className="flex flex-wrap gap-2 mt-1">
                                                 {Array.isArray(filter.options) && filter.options.map((opt: any, oIdx: number) => (
                                                     <button
                                                         key={oIdx}
                                                         className={`gen-ui-tag ${opt.active ? 'gen-ui-tag-trending' : ''}`}
                                                     >
                                                         {opt.label}
                                                     </button>
                                                 ))}
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         </ComponentWrapper>
                     );

                case 'tag_cloud':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="space-y-3">
                                 {props.label ? (
                                     <h4 className="gen-ui-label">
                                         {props.label}
                                     </h4>
                                 ) : null}
                                 <div className="flex flex-wrap gap-2">
                                     {Array.isArray(props.tags) && props.tags.map((tag: any, idx: number) => {
                                         const opacityClass = tag.trending ? 'gen-ui-tag-trending' : '';
                                         return (
                                             <button
                                                 key={idx}
                                                 className={`gen-ui-tag ${opacityClass}`}
                                             >
                                                 {tag.name}
                                             </button>
                                         );
                                     })}
                                 </div>
                             </div>
                         </ComponentWrapper>
                     );

                case 'timeline':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="space-y-4">
                                 {props.label ? (
                                     <h4 className="gen-ui-label">
                                         {props.label}
                                     </h4>
                                 ) : null}
                                 <div style={{ position: 'relative' }}>
                                     {Array.isArray(props.timeline) && props.timeline.map((item: any, idx: number) => (
                                         <div key={idx} className="flex gap-4 pb-6 relative">
                                             <div className="flex flex-col items-center">
                                                 <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent)', marginTop: '6px', position: 'relative', zIndex: 10 }}></div>
                                                 {idx !== props.timeline.length - 1 ? (
                                                     <div style={{ width: '2px', height: '100%', background: 'var(--border-light)', position: 'absolute', top: '18px', left: '5px' }}></div>
                                                 ) : null}
                                             </div>
                                             <div className="flex-1 pt-0.5">
                                                 <p style={{ fontSize: '0.75em', fontFamily: 'monospace', color: 'var(--text-tertiary)', margin: 0 }}>{item.date}</p>
                                                 <h5 style={{ fontWeight: 'bold', margin: '4px 0', color: 'var(--text-primary)' }}>{item.title}</h5>
                                                 {item.description ? (
                                                     <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)', margin: 0 }}>{item.description}</p>
                                                 ) : null}
                                                 {item.category ? (
                                                     <span className="gen-ui-tag" style={{ fontSize: '0.7em', padding: '2px 6px', marginTop: '4px', display: 'inline-block' }}>
                                                         {item.category}
                                                     </span>
                                                 ) : null}
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         </ComponentWrapper>
                     );

                case 'geographic':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="space-y-4">
                                 {props.label ? (
                                     <h4 className="gen-ui-label">
                                         {props.label}
                                     </h4>
                                 ) : null}
                                 <div className="space-y-2">
                                     {Array.isArray(props.locations) && props.locations.map((loc: any, idx: number) => {
                                         const maxValue = Math.max(...props.locations.map((l: any) => l.value || 0));
                                         const percentage = ((loc.value || 0) / maxValue) * 100;
                                         return (
                                             <div key={idx} style={{ marginBottom: '8px' }}>
                                                 <div className="flex justify-between text-sm" style={{ marginBottom: '4px' }}>
                                                     <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>{loc.location}</span>
                                                     <span style={{ color: 'var(--text-tertiary)' }}>{loc.value}</span>
                                                 </div>
                                                 <div style={{ width: '100%', height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                                                     <div
                                                         style={{ width: `${percentage}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.5s ease' }}
                                                     ></div>
                                                 </div>
                                             </div>
                                         );
                                     })}
                                 </div>
                             </div>
                         </ComponentWrapper>
                     );

                default:
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className="gen-ui-alert gen-ui-alert-error">
                                Unknown: {type}
                            </div>
                        </ComponentWrapper>
                    );
            }
        } catch (err) {
            console.error(`Error rendering component ${type}`, err);
            return <div className="gen-ui-alert gen-ui-alert-error">Render Error: {type}</div>;
        }
    };

    try {
        if (!data || !data.type) return null;

        const rootChildren = Array.isArray(data.children) ? data.children : [];

        return (
            <div className="gen-ui-container gen-ui-root">
                {data.type === 'container' ? (
                    rootChildren.map((child, index) => renderComponent(child, index))
                ) : (
                    <div className="gen-ui-alert gen-ui-alert-error">Error: Root must be a container</div>
                )}
                {rootChildren.length === 0 ? (
                    <div style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>Empty container generated.</div>
                ) : null}
            </div>
        );
    } catch (err) {
        console.error("Root Render Error", err);
        return <div style={{ color: 'red' }}>Critical Error in UI Renderer</div>;
    }
};

export default React.memo(GenerativeUIRenderer);