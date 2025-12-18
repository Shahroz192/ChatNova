export interface UIContainer {
    type: 'container';
    children: UIComponent[];
}

export interface UIComponent {
    type:
    | 'button'
    | 'data'
    | 'container'
    | 'text'
    | 'layout'
    | 'content'
    | 'form'
    | 'row'
    | 'card'
    | 'slides'
    | 'table'
    | 'chart'
    | 'image'
    | 'alert'
    | 'input'
    | 'textarea'
    | 'checkbox'
    | 'select'
    | 'loading'
    | 'error'
    | 'search_results'
    | 'news_card'
    | 'image_gallery'
    | 'search_analytics'
    | 'pagination'
    | 'search_controls';
    props: Record<string, any>;
}

export interface SearchResultData {
    title: string;
    url: string;
    snippet: string;
    source: string;
    relevance_score?: number;
    timestamp?: string;
    thumbnail?: string;
}

export interface PaginationData {
    current_page: number;
    total_pages: number;
    has_previous: boolean;
    has_next: boolean;
    page_size: number;
}

export interface ChartData {
    name: string;
    value: number;
    category?: string;
    color?: string;
}
