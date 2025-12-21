import React, { useState } from 'react';
import type { UIContainer, UIComponent, ChartData } from '../../types/generative-ui';
import type { ImageGalleryData } from '../../types/search';
import ChartRenderer from './ChartRenderer';
import SearchResults from './SearchResults';
import NewsCard from './NewsCard';
import ImageGallery from './ImageGallery';

interface RendererProps {
    data: UIContainer | null;
}

const SlidesWrapper = ({ children }: { children?: React.ReactNode }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const kids = React.Children.toArray(children);

    if (kids.length === 0) return null;

    const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % kids.length);
    const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + kids.length) % kids.length);

    return (
        <div className="w-full border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Slide {currentIndex + 1} of {kids.length}</span>
                <div className="flex gap-2">
                    <button onClick={prevSlide} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 transition-colors" aria-label="Previous slide">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button onClick={nextSlide} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 transition-colors" aria-label="Next slide">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>
            <div className="p-6">
                {kids[currentIndex]}
            </div>
            <div className="flex justify-center gap-1.5 pb-4">
                {kids.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-indigo-600 w-4' : 'bg-slate-300 dark:bg-slate-600'}`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

const widthClasses: Record<string, string> = {
    'full': 'w-full',
    '1/2': 'w-full md:w-[calc(50%-0.5rem)]',
    '1/3': 'w-full md:w-[calc(33.333%-0.667rem)]',
    '2/3': 'w-full md:w-[calc(66.667%-0.333rem)]',
    '1/4': 'w-full md:w-[calc(25%-0.75rem)]',
    '3/4': 'w-full md:w-[calc(75%-0.25rem)]',
    'undefined': 'w-full'
};

interface WrapperProps {
    children?: React.ReactNode;
    width?: string;
}

const ComponentWrapper: React.FC<WrapperProps> = ({ children, width }) => {
    const widthClass = width ? widthClasses[width] || 'w-full' : 'w-full';
    return (
        <div className={widthClass}>
            {children}
        </div>
    );
};

const GenerativeUIRenderer: React.FC<RendererProps> = ({ data }) => {
    if (!data) return null;

    const renderChart = (props: UIComponent['props']) => {
        if (!props) {
            console.log('No props provided to renderChart');
            return null;
        }

        const { chartType, data: chartData, label } = props;

        console.log('Chart Type:', chartType, 'Label:', label, 'Data:', chartData);

        if (!chartType || !['bar', 'line', 'pie'].includes(chartType)) {
            console.error('Invalid or missing chartType:', chartType);
            return (
                <div className="h-32 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 italic text-sm">
                    Invalid chart type: {chartType || 'missing'}
                </div>
            );
        }

        // Handle stringified JSON
        let processedData = chartData;
        if (typeof chartData === 'string') {
            try {
                processedData = JSON.parse(chartData);
            } catch (e) {
                console.error("Failed to parse chart data string", e);
                processedData = [];
            }
        }

        const dataArray = Array.isArray(processedData) ? processedData : [];
        if (dataArray.length === 0) {
            return (
                <div className="h-32 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 italic text-sm">
                    No chart data generated
                </div>
            );
        }

        // Ensure each data item has name and value (compatible with ChartData interface)
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
            <div className="chart-container w-full h-[50vh] lg:h-[60vh]">
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
            return <div className="text-slate-400 italic">No search results available</div>;
        }

        return (
            <SearchResults
                results={results}
                searchQuery={search_query}
                totalResults={total_results}
                searchTimeMs={search_time_ms}
                currentPage={pagination?.current_page}
                totalPages={pagination?.total_pages}
                onResultClick={(result) => {
                    // Handle result click - could open in new tab
                    window.open(result.url, '_blank');
                }}
                onShareResult={(result) => {
                    // Handle share result
                    if (navigator.share) {
                        navigator.share({
                            title: result.title,
                            text: result.snippet,
                            url: result.url,
                        });
                    } else {
                        navigator.clipboard.writeText(result.url);
                    }
                }}
            />
        );
    };

    const renderNewsCard = (props: any) => {
        const { title, source_url, snippet, source_name, timestamp, tags, actions } = props;

        return (
            <NewsCard
                article={{
                    title,
                    source_url,
                    snippet,
                    source_name,
                    timestamp,
                    tags,
                    actions
                }}
                onShare={(article) => {
                    // Handle share article
                    if (navigator.share) {
                        navigator.share({
                            title: article.title,
                            text: article.snippet,
                            url: article.source_url,
                        });
                    } else {
                        navigator.clipboard.writeText(article.source_url);
                    }
                }}
                onReadMore={(article) => {
                    // Handle read more
                    window.open(article.source_url, '_blank');
                }}
            />
        );
    };

    const renderImageGallery = (props: any) => {
        const { images, title, total_count } = props;

        if (!Array.isArray(images)) {
            return <div className="text-slate-400 italic">No images available</div>;
        }

        const galleryData: ImageGalleryData = {
            images: images.map((img: any) => ({
                src: img.src || img.url,
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
                onImageClick={(image, index) => {
                    // Handle image click
                    console.log('Image clicked:', image, index);
                }}
                onImageShare={(image) => {
                    // Handle image share
                    if (navigator.share) {
                        navigator.share({
                            title: image.title || image.alt,
                            text: `Check out this image: ${image.title || image.alt}`,
                            url: image.url || image.src,
                        });
                    } else {
                        navigator.clipboard.writeText(image.url || image.src);
                    }
                }}
            />
        );
    };



    const renderLoading = (props: any) => {
        const { label } = props;

        return (
            <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    <span className="text-slate-600 dark:text-slate-400">{label || 'Loading...'}</span>
                </div>
            </div>
        );
    };

    const renderError = (props: any) => {
        const { label, text, actions } = props;

        return (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                        <h3 className="font-medium text-red-800 dark:text-red-200">{label || 'Error'}</h3>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">{text}</p>
                        {actions && actions.length > 0 && (
                            <div className="flex gap-2 mt-3">
                                {actions.map((action: string, index: number) => (
                                    <button key={index} className="px-3 py-1 text-sm bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-700 transition-colors">
                                        {action.replace('_', ' ').toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
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
                                    <div key={`slide-${childIdx}`} className="h-full flex flex-col">
                                        {renderComponent(child, childIdx, true)}
                                    </div>
                                ))}
                            </SlidesWrapper>
                        </ComponentWrapper>
                    );

                case 'card':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-full flex flex-col">
                                {props.label && (
                                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200">
                                        {props.label}
                                    </div>
                                )}
                                <div className="p-4 flex flex-col gap-4 flex-1">
                                    {children.map((child, childIdx) => renderComponent(child, childIdx, true))}
                                </div>
                            </div>
                        </ComponentWrapper>
                    );

                case 'row':
                    return (
                        <div key={key} className="w-full flex flex-row flex-wrap gap-4 items-start">
                            {children.map((child, childIdx) => renderComponent(child, childIdx, true))}
                        </div>
                    );

                case 'image':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className="flex flex-col items-center">
                                <div className="relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
                                    <img
                                        src={props.src}
                                        alt={props.alt || props.label || 'Image'}
                                        className="max-h-32 object-contain"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                        }}
                                    />
                                    <div className="hidden h-32 w-32 flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-400">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                </div>
                                {props.label && <span className="mt-2 text-sm text-slate-600 dark:text-slate-400 font-medium">{props.label}</span>}
                            </div>
                        </ComponentWrapper>
                    );

                case 'text':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <p className="text-slate-800 dark:text-slate-200 font-medium text-lg leading-relaxed">
                                {props.label || props.text}
                            </p>
                        </ComponentWrapper>
                    );

                case 'alert': {
                    const variantStyles = {
                        success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200',
                        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-200',
                        error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200',
                        info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200',
                        primary: 'bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-200',
                        secondary: 'bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200',
                        danger: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200',
                    };
                    const styleClass = (variantStyles as any)[props.variant || 'info'] || variantStyles.info;

                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div role={props.variant === 'danger' || props.variant === 'error' ? 'alert' : 'status'} className={`p-4 rounded-lg border ${styleClass} flex items-start gap-3`}>
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0 opacity-70" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <p className="font-medium">{props.label}</p>
                            </div>
                        </ComponentWrapper>
                    );
                }

                // Search-specific components
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
                                <label htmlFor={inputId} className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                    {props.label}
                                </label>
                                <input
                                    id={inputId}
                                    type="text"
                                    placeholder={props.placeholder}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-500"
                                />
                            </div>
                        </ComponentWrapper>
                    );

                case 'textarea':
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor={inputId} className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                    {props.label}
                                </label>
                                <textarea
                                    id={inputId}
                                    placeholder={props.placeholder}
                                    rows={3}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-500 resize-y"
                                />
                            </div>
                        </ComponentWrapper>
                    );

                case 'table':
                    const rows = props.rows || [];
                    return (
                        <ComponentWrapper width={props.width} key={key}>
                            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                {props.label && (
                                    <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                                        <h3 className="font-bold text-slate-800 dark:text-slate-200">{props.label}</h3>
                                    </div>
                                )}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                                            <tr>
                                                {props.headers?.map((head: any, hIdx: number) => (
                                                    <th key={hIdx} className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">{head}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                            {rows.map((row: any, rIdx: number) => (
                                                <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                                    {row.map((cell: any, cIdx: number) => (
                                                        <td key={cIdx} className="px-4 py-3">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                            {rows.length === 0 && (
                                                <tr><td colSpan={props.headers?.length || 1} className="px-4 py-4 text-center italic text-slate-400">No data generated</td></tr>
                                            )}
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
                                <div className="mb-2 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{props.label}</h3>
                                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase border border-slate-200 dark:border-slate-700">{props.chartType}</span>
                                </div>
                                {renderChart(props)}
                            </div>
                        </ComponentWrapper>
                    );

                case 'button':
                     const btnVariantStyles = {
                         primary: 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500',
                         secondary: 'bg-slate-200 hover:bg-slate-300 text-slate-900 focus:ring-slate-500',
                         danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
                         success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
                         warning: 'bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-500',
                         info: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
                     };
                     const btnClass = btnVariantStyles[props.variant as keyof typeof btnVariantStyles || 'primary'];

                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="mt-2">
                                 <button
                                     onClick={() => alert(`Clicked: ${props.label}`)}
                                     className={`w-full font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transform active:scale-95 transition-all duration-200 ${btnClass}`}
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
                                     className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                 />
                                 <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                     {props.label}
                                 </label>
                             </div>
                         </ComponentWrapper>
                     );

                case 'radio':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <fieldset className="space-y-3">
                                 {props.label && (
                                     <legend className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                         {props.label}
                                     </legend>
                                 )}
                                 <div className="space-y-2">
                                     {Array.isArray(props.options) && props.options.map((option: any, idx: number) => (
                                         <div key={idx} className="flex items-center gap-3">
                                             <input
                                                 id={`radio-${inputId}-${idx}`}
                                                 type="radio"
                                                 name={props.name || `radio-${inputId}`}
                                                 value={option}
                                                 defaultChecked={props.value === option}
                                                 className="w-4 h-4 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                             />
                                             <label htmlFor={`radio-${inputId}-${idx}`} className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
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
                                 <label htmlFor={inputId} className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                     {props.label}
                                 </label>
                                 <select
                                     id={inputId}
                                     defaultValue={props.value || ''}
                                     className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all outline-none text-slate-900 dark:text-slate-100"
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
                     // Generic container wrappers - render children
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className={props.variant === 'card' ? 'p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800' : ''}>
                                 {props.label && (
                                     <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
                                         {props.label}
                                     </h3>
                                 )}
                                 {Array.isArray(props.children) && (
                                     <div className="flex flex-col gap-4">
                                         {props.children.map((child: any, idx: number) => renderComponent(child, idx))}
                                     </div>
                                 )}
                             </div>
                         </ComponentWrapper>
                     );

                case 'source_citation':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700">
                                 Source: <a href={props.source_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                     {props.source_name || props.source_url}
                                 </a>
                                 {props.timestamp && <span className="ml-2 text-slate-400">{new Date(props.timestamp).toLocaleDateString()}</span>}
                             </div>
                         </ComponentWrapper>
                     );

                case 'search_summary':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                                 <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                                     <span className="font-bold text-indigo-800 dark:text-indigo-200">{props.total_results || 0}</span> results found in <span className="font-bold text-indigo-800 dark:text-indigo-200">{props.search_time_ms || 0}ms</span>
                                 </p>
                                 {props.summary && <p className="text-sm text-slate-600 dark:text-slate-400 italic">{props.summary}</p>}
                             </div>
                         </ComponentWrapper>
                     );

                case 'related_searches':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="space-y-2">
                                 {props.label && (
                                     <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                         {props.label}
                                     </h4>
                                 )}
                                 <div className="flex flex-wrap gap-2">
                                     {Array.isArray(props.searches) && props.searches.map((search: any, idx: number) => (
                                         <button
                                             key={idx}
                                             className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-sm transition-colors border border-slate-200 dark:border-slate-600"
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
                             <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-4">
                                 {props.label && (
                                     <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                         {props.label}
                                     </h4>
                                 )}
                                 <div className="space-y-3">
                                     {Array.isArray(props.filters) && props.filters.map((filter: any, fIdx: number) => (
                                         <div key={fIdx}>
                                             <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">{filter.label}</label>
                                             <div className="flex flex-wrap gap-2 mt-1">
                                                 {Array.isArray(filter.options) && filter.options.map((opt: any, oIdx: number) => (
                                                     <button
                                                         key={oIdx}
                                                         className={`px-2 py-1 text-xs rounded border transition-all ${opt.active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'}`}
                                                     >
                                                         {opt.label}
                                                     </button>
                                                 ))}
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                                 {Array.isArray(props.sort_options) && props.sort_options.length > 0 && (
                                     <div>
                                         <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Sort by</label>
                                         <div className="flex gap-2 mt-1 flex-wrap">
                                             {props.sort_options.map((sort: any, sIdx: number) => (
                                                 <button
                                                     key={sIdx}
                                                     className={`px-2 py-1 text-xs rounded border transition-all ${sort.active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'}`}
                                                 >
                                                     {sort.label}
                                                 </button>
                                             ))}
                                         </div>
                                     </div>
                                 )}
                             </div>
                         </ComponentWrapper>
                     );

                case 'tag_cloud':
                     return (
                         <ComponentWrapper width={props.width} key={key}>
                             <div className="space-y-3">
                                 {props.label && (
                                     <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                         {props.label}
                                     </h4>
                                 )}
                                 <div className="flex flex-wrap gap-2">
                                     {Array.isArray(props.tags) && props.tags.map((tag: any, idx: number) => {
                                         // Size based on count/popularity
                                         const maxCount = Math.max(...props.tags.map((t: any) => t.count || 1));
                                         const sizeFactor = (tag.count || 1) / maxCount;
                                         const textSize = 0.75 + sizeFactor * 0.5; // 0.75rem to 1.25rem
                                         const opacityClass = tag.trending ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-400';
                                         return (
                                             <button
                                                 key={idx}
                                                 style={{ fontSize: `${textSize}rem` }}
                                                 className={`px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors ${opacityClass}`}
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
                                 {props.label && (
                                     <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                         {props.label}
                                     </h4>
                                 )}
                                 <div className="relative">
                                     {Array.isArray(props.timeline) && props.timeline.map((item: any, idx: number) => (
                                         <div key={idx} className="flex gap-4 pb-6 relative">
                                             <div className="flex flex-col items-center">
                                                 <div className="w-3 h-3 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-1.5 relative z-10"></div>
                                                 {idx !== props.timeline.length - 1 && (
                                                     <div className="w-0.5 h-12 bg-slate-200 dark:bg-slate-700 my-2"></div>
                                                 )}
                                             </div>
                                             <div className="flex-1 pt-0.5">
                                                 <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{item.date}</p>
                                                 <h5 className="font-semibold text-slate-800 dark:text-slate-200">{item.title}</h5>
                                                 {item.description && (
                                                     <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{item.description}</p>
                                                 )}
                                                 {item.category && (
                                                     <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
                                                         {item.category}
                                                     </span>
                                                 )}
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
                                 {props.label && (
                                     <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                         {props.label}
                                     </h4>
                                 )}
                                 <div className="space-y-2">
                                     {Array.isArray(props.locations) && props.locations.map((loc: any, idx: number) => {
                                         // Normalize value for bar width (0-100)
                                         const maxValue = Math.max(...props.locations.map((l: any) => l.value || 0));
                                         const percentage = ((loc.value || 0) / maxValue) * 100;
                                         return (
                                             <div key={idx} className="space-y-1">
                                                 <div className="flex justify-between text-sm">
                                                     <span className="font-medium text-slate-700 dark:text-slate-300">{loc.location}</span>
                                                     <span className="text-slate-600 dark:text-slate-400">{loc.value}</span>
                                                 </div>
                                                 <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                                     <div
                                                         className="bg-indigo-600 dark:bg-indigo-400 h-full rounded-full transition-all"
                                                         style={{ width: `${percentage}%` }}
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
                            <div className="p-2 border border-red-300 bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-200 rounded">
                                Unknown: {type}
                            </div>
                        </ComponentWrapper>
                    );
            }
        } catch (err) {
            console.error(`Error rendering component ${type}`, err);
            return <div className="p-2 bg-red-50 text-red-600 text-xs">Render Error: {type}</div>;
        }
    };

    // Safe root rendering
    try {
        if (!data || !data.type) return null;

        // Safely handle root children
        const rootChildren = Array.isArray(data.children) ? data.children : [];

        return (
            <div
                className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 w-full flex flex-col gap-6"
                style={{ width: '415px' }}
            >
                {data.type === 'container' ? (
                    rootChildren.map((child, index) => renderComponent(child, index))
                ) : (
                    <div className="text-red-500">Error: Root must be a container</div>
                )}
                {rootChildren.length === 0 && (
                    <div className="text-slate-400 italic text-center">Empty container generated.</div>
                )}
            </div>
        );
    } catch (err) {
        console.error("Root Render Error", err);
        return <div className="text-red-600">Critical Error in UI Renderer</div>;
    }
};

export default GenerativeUIRenderer;
