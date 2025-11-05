import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
  darkMode: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, darkMode }) => {
    return (
        <div className="markdown-content">
            <ReactMarkdown
                components={{
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
                                    style={darkMode ? oneDark : oneLight}
                                    language={match[1]}
                                    PreTag="div"
                                >
                                    {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                            </div>
                        );
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownRenderer;
