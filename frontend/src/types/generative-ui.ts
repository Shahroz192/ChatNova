export interface UIContainer {
    type: 'container';
    children: UIComponent[];
}

export interface UIComponent {
    type: 'container' | 'custom';
    props: Record<string, any>;
}
