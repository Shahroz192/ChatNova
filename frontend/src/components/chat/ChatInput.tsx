import React, { useState, useRef, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import {
  Send,
  Search,
  Globe,
  Loader,
  Clock
} from 'lucide-react';
import type { WebSearchOptions } from '../../types/search';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  sendMessage: () => void;
  loading: boolean;
  searchOptions?: WebSearchOptions;
  onSearchOptionsChange?: (options: WebSearchOptions) => void;
  searchSuggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
  recentSearches?: string[];
  onRecentSearchSelect?: (query: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  handleKeyPress,
  sendMessage,
  loading,
  searchOptions = { search_web: false },
  onSearchOptionsChange,
  searchSuggestions = [],
  onSuggestionSelect,
  recentSearches = [],
  onRecentSearchSelect
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleWebSearchToggle = () => {
    const newOptions = {
      ...searchOptions,
      search_web: !searchOptions.search_web
    };
    onSearchOptionsChange?.(newOptions);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    onSuggestionSelect?.(suggestion);
  };

  const handleRecentSearchClick = (query: string) => {
    setInput(query);
    onRecentSearchSelect?.(query);
  };

  return (
    <div className="chat-input-container">
      {/* Suggestions dropdown */}
      {showSuggestions && (searchSuggestions.length > 0 || recentSearches.length > 0) && (
        <div
          ref={suggestionsRef}
          className="search-suggestions-dropdown position-absolute bottom-100 start-0 w-100 bg-white border rounded-bottom shadow-lg mb-2"
          style={{ zIndex: 1050 }}
        >
          {/* Search suggestions */}
          {searchSuggestions.length > 0 && (
            <div className="suggestions-section">
              <div className="suggestions-header p-2 border-bottom">
                <small className="text-muted fw-bold">Suggestions</small>
              </div>
              {searchSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="suggestion-item w-100 text-start p-2 border-0 bg-transparent"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <div className="d-flex align-items-center gap-2">
                    <Search size={14} className="text-muted" />
                    <span>{suggestion}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div className="recent-searches-section">
              <div className="recent-searches-header p-2 border-top border-bottom">
                <small className="text-muted fw-bold">Recent Searches</small>
              </div>
              {recentSearches.slice(0, 5).map((query, index) => (
                <button
                  key={index}
                  className="recent-search-item w-100 text-start p-2 border-0 bg-transparent"
                  onClick={() => handleRecentSearchClick(query)}
                >
                  <div className="d-flex align-items-center gap-2">
                    <Clock size={14} className="text-muted" />
                    <span>{query}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main input area */}
      <div className="d-flex gap-2 align-items-end">
        {/* Search controls */}
        <div className="search-controls d-flex flex-column gap-1">
          {/* Web search toggle */}
          <Button
            variant={searchOptions.search_web ? "primary" : "outline-secondary"}
            size="sm"
            onClick={handleWebSearchToggle}
            className="search-toggle-btn"
            title="Toggle web search"
          >
            <Search size={16} />
          </Button>
        </div>

        {/* Input area */}
        <div className="flex-grow-1 position-relative">
          <Form.Control
            as="textarea"
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(e.target.value.length > 0);
            }}
            onKeyDown={(e) => {
              handleKeyPress(e);
              if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            onFocus={() => {
              if (input.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              // Delay hiding suggestions to allow clicking
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            placeholder={
              searchOptions.search_web
                ? "Search the web..."
                : "Type your message..."
            }
            className="input-field search-input"
            style={{ resize: 'none' }}
          />
        </div>

        {/* Send button */}
        <Button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          variant="secondary"
          className="send-button rounded-circle d-flex align-items-center justify-content-center"
          style={{
            width: "56px",
            height: "56px",
            alignSelf: "center",
            backgroundColor: "#000000 !important",
            color: "#ffffff !important"
          }}
        >
          {loading ? (
            <Loader size={20} className="animate-spin" />
          ) : (
            <Send size={20} />
          )}
        </Button>
      </div>

      {/* Search status */}
      {searchOptions.search_web && (
        <div className="search-status mt-2">
          <small className="text-muted d-flex align-items-center gap-2">
            <Globe size={14} />
            Web search enabled
          </small>
        </div>
      )}
    </div>
  );
};

export default ChatInput;
