import React from 'react';
import type { UIContainer } from '../../types/generative-ui';
import '../../styles/GenerativeUI.css';

interface RendererProps {
    data: UIContainer | null;
}

const RESIZE_SCRIPT_ID = 'genui-resize';

// Reports content height once after load, then only on window resize events (no ResizeObserver loop)
function buildResizeScript(): string {
    return [
        '<script>',
        '(function(){',
        'function r(){',
        'var h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);',
        "window.parent.postMessage({type:'" + RESIZE_SCRIPT_ID + "',height:h},'*');",
        '}',
        "window.addEventListener('load',function(){setTimeout(r,300)});",
        "if(document.readyState==='complete')setTimeout(r,300);",
        "window.addEventListener('resize',r);",
        '})();',
        '</script>',
        '</body>',
    ].join('\n');
}

const SandboxedIframe = React.memo(({ html }: { html: string }) => {
    const [tab, setTab] = React.useState<'preview' | 'code'>('preview');
    const [copied, setCopied] = React.useState(false);
    const [iframeHeight, setIframeHeight] = React.useState(180);
    const iframeHeightRef = React.useRef(180);

    // Listen for postMessage from the sandboxed iframe reporting its content height
    React.useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === RESIZE_SCRIPT_ID && typeof event.data.height === 'number') {
                const newH = Math.min(event.data.height + 48, 600);
                // Only update if meaningfully different to avoid feedback loops
                if (Math.abs(newH - iframeHeightRef.current) > 5) {
                    iframeHeightRef.current = newH;
                    setIframeHeight(newH);
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    // Inject a resize-reporting script before </body>
    const injectedHtml = React.useMemo(() => {
        const script = buildResizeScript();
        const idx = html.lastIndexOf('</body>');
        if (idx !== -1) {
            return html.slice(0, idx) + script;
        }
        return html + script;
    }, [html]);

    const handleCopy = React.useCallback(async () => {
        try {
            await navigator.clipboard.writeText(html);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { return }
    }, [html]);

    return (
        <div style={{ borderRadius: 'var(--radius-xs)', overflow: 'clip', border: '1px solid var(--border-light)' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '0 12px', height: '34px',
                borderBottom: '1px solid var(--border-light)',
                background: 'var(--bg-secondary)',
            }}>
                <button onClick={() => setTab('preview')} style={{
                    padding: '0 2px', height: '100%', border: 'none', cursor: 'pointer',
                    background: 'transparent', color: 'var(--text-primary)',
                    fontSize: '0.75rem', fontWeight: tab === 'preview' ? '500' : '400',
                    borderBottom: tab === 'preview' ? '2px solid var(--text-primary)' : '2px solid transparent',
                }}>Preview</button>
                <button onClick={() => setTab('code')} style={{
                    padding: '0 2px', height: '100%', border: 'none', cursor: 'pointer',
                    background: 'transparent', color: 'var(--text-primary)',
                    fontSize: '0.75rem', fontWeight: tab === 'code' ? '500' : '400',
                    borderBottom: tab === 'code' ? '2px solid var(--text-primary)' : '2px solid transparent',
                }}>Code</button>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {tab === 'code' && (
                        <button onClick={handleCopy} style={{
                            padding: '2px 8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xs)',
                            cursor: 'pointer', background: 'transparent', color: 'var(--text-tertiary)',
                            fontSize: '0.7rem', fontFamily: 'inherit',
                        }}>
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    )}
                </div>
            </div>

            {tab === 'preview' ? (
                <iframe
                    sandbox="allow-scripts"
                    srcDoc={injectedHtml}
                    title="sandboxed-ui"
                    style={{ width: '100%', height: iframeHeight ?? 0, border: 'none', display: 'block', background: '#fff' }}
                />
            ) : (
                <pre style={{
                    margin: 0, padding: '12px', overflow: 'auto',
                    fontSize: '0.75rem', lineHeight: 1.5, fontFamily: 'monospace',
                    background: '#0d1117', color: '#c9d1d9',
                }}>{html}</pre>
            )}
        </div>
    );
});

const GenerativeUIRenderer: React.FC<RendererProps> = ({ data }) => {
    if (!data || data.type !== 'container') return null;

    const children = Array.isArray(data.children) ? data.children : [];

    if (children.length === 0) return null;

    return (
        <>
            {children.map((child, index) => {
                if (!child || child.type !== 'custom' || !child.props?.html) return null;
                return <SandboxedIframe key={index} html={child.props.html} />;
            })}
        </>
    );
};

export default React.memo(GenerativeUIRenderer);
