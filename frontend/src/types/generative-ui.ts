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
    | 'radio'
    | 'select'
    | 'loading'
    | 'error'
    | 'search_results'
    | 'news_card'
    | 'image_gallery'
    | 'source_citation'
    | 'search_summary'
    | 'related_searches'
    | 'search_controls'
    | 'tag_cloud'
    | 'timeline'
    | 'geographic';
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

export interface TimelineData {
     date: string;
     title: string;
     description: string;
     category?: string;
     importance?: number;
}

export interface TagData {
     name: string;
     count: number;
     category?: string;
     trending?: boolean;
}

export interface GeographicData {
     location: string;
     latitude?: number;
     longitude?: number;
     value: number;
     label?: string;
}

export interface FilterOption {
     value: string;
     label: string;
     active: boolean;
}

export interface FilterData {
     id: string;
     label: string;
     options: FilterOption[];
}

export interface SortOption {
     value: string;
     label: string;
     active: boolean;
}
