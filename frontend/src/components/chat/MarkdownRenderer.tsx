import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../../hooks/useTheme';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    const { isDark } = useTheme();

    const components = useMemo(() => ({
        code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            return isInline ? (
                <code className={className} {...props}>
                    {children}
                </code>
            ) : (
                <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                    <SyntaxHighlighter
                        style={isDark ? oneDark : oneLight}
                        language={match[1]}
                        PreTag="div"
                    >
                        {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                </div>
            );
        },
    }), [isDark]);

    return (
        <div className="markdown-content">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={components}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default React.memo(MarkdownRenderer);
