import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send,
  Search,
  Globe,
  Loader,
  Clock,
  Mic,
  Square,
  Paperclip,
  X,
  FileText,
  ChevronDown
} from 'lucide-react';
import type { WebSearchOptions } from '../../types/search';
import { transcribeAudio } from '../../utils/api';

interface ChatInputProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  sendMessage: (images?: string[]) => void;
  loading: boolean;
  isUploadingDocs?: boolean;
  searchOptions?: WebSearchOptions;
  onSearchOptionsChange?: (options: WebSearchOptions) => void;
  searchSuggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
  recentSearches?: string[];
  onRecentSearchSelect?: (query: string) => void;
  selectedModel: string;
  onFileUpload: (file: File) => void;
  models?: string[];
  useTools?: boolean;
  onUseToolsChange?: (use: boolean) => void;
  onModelSelect?: (model: string) => void;
  showOnboarding?: boolean;
  onDismissOnboarding?: () => void;
}

type RecordingState = 'idle' | 'recording' | 'processing';

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  sendMessage,
  loading,
  isUploadingDocs = false,
  searchOptions = { search_web: false },
  onSearchOptionsChange,
  searchSuggestions = [],
  onSuggestionSelect,
  recentSearches = [],
  onRecentSearchSelect,
  selectedModel,
  onFileUpload,
  models = [],
  useTools = false,
  onUseToolsChange,
  onModelSelect,
  showOnboarding = false,
  onDismissOnboarding
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [pendingImages, setPendingImages] = useState<{name: string, data: string}[]>([]);
  const [pendingDocs, setPendingDocs] = useState<{name: string}[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isGemini = useMemo(() => selectedModel.toLowerCase().includes('gemini'), [selectedModel]);

  const commands = useMemo(() => [
    { 
      id: 'search', 
      name: `Search: ${searchOptions.search_web ? 'ON' : 'OFF'}`, 
      icon: <Globe size={14} />,
      action: () => handleWebSearchToggle()
    },
    { 
      id: 'tools', 
      name: `Tools: ${useTools ? 'ON' : 'OFF'}`, 
      icon: <FileText size={14} />,
      action: () => onUseToolsChange?.(!useTools)
    }
  ], [searchOptions.search_web, useTools, onUseToolsChange]);

  const filteredCommands = useMemo(() => {
    if (!commandFilter) return commands;
    return commands.filter(c => c.name.toLowerCase().includes(commandFilter.toLowerCase()));
  }, [commands, commandFilter]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleWebSearchToggle = useCallback(() => {
    if (onSearchOptionsChange) {
      onSearchOptionsChange({
        ...searchOptions,
        search_web: !searchOptions.search_web
      });
    }
  }, [onSearchOptionsChange, searchOptions]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
    }
    setShowSuggestions(false);
  }, [onSuggestionSelect]);

  const handleRecentSearchClick = useCallback((query: string) => {
    if (onRecentSearchSelect) {
      onRecentSearchSelect(query);
    }
    setShowSuggestions(false);
  }, [onRecentSearchSelect]);

  const toggleRecording = useCallback(async () => {
    if (recordingState === 'idle') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = async () => {
          setRecordingState('processing');
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
          try {
            const text = await transcribeAudio(audioBlob);
            setInput((prev: string) => prev ? `${prev} ${text}` : text);
          } catch (error) {
            console.error('Transcription error:', error);
          } finally {
            setRecordingState('idle');
            setRecordingTime(0);
          }
        };

        mediaRecorder.start();
        setRecordingState('recording');
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } catch (error) {
        console.error('Error accessing microphone:', error);
      }
    } else if (recordingState === 'recording') {
      mediaRecorderRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
    }
  }, [recordingState, setInput]);

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith('image/');

      if (isImage) {
        if (!isGemini) {
          alert("Images are only supported for Gemini models. Please switch model to upload images.");
          continue;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          setPendingImages(prev => [...prev, { name: file.name, data: base64 }]);
        };
        reader.readAsDataURL(file);
      } else {
        // Document
        setPendingDocs(prev => [...prev, { name: file.name }]);
        onFileUpload(file);
      }
    }
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [isGemini, onFileUpload]);

  const removeImage = useCallback((index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const removeDoc = useCallback((index: number) => {
    setPendingDocs(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSendMessage = useCallback(() => {
    if (isUploadingDocs) {
      alert("Documents are still uploading. Please wait a moment.");
      return;
    }
    const images = pendingImages.map(img => img.data);
    sendMessage(images);
    setPendingImages([]);
    setPendingDocs([]);
  }, [pendingImages, sendMessage, isUploadingDocs]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    
    if (value.startsWith('/')) {
      setShowCommands(true);
      setCommandFilter(value.slice(1));
      setShowSuggestions(false);
      setShowModelDropdown(false);
    } else {
      setShowCommands(false);
      setShowSuggestions(value.length > 0);
    }
  }, [setInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (showCommands && filteredCommands.length > 0) {
        e.preventDefault();
        filteredCommands[0].action();
        setShowCommands(false);
        return;
      }
      e.preventDefault();
      handleSendMessage();
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setShowCommands(false);
      setShowModelDropdown(false);
    }
  }, [handleSendMessage, showCommands, filteredCommands]);

  const handleFocus = useCallback(() => {
    if (input.startsWith('/')) {
      setShowCommands(true);
    } else {
      setShowSuggestions(true);
    }
  }, [input]);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setShowSuggestions(false);
      setShowCommands(false);
      setShowModelDropdown(false);
    }, 200);
  }, []);

  return (
    <div className="chat-input-wrapper">
      {/* Attachment Preview */}
      {(pendingImages.length > 0 || pendingDocs.length > 0) ? (
        <div className="attachment-preview-container">
          {pendingImages.map((img, index) => (
            <div key={`img-${index}`} className="attachment-preview-item">
              <img src={img.data} alt={img.name} className="attachment-thumbnail" />
              <button className="remove-attachment" onClick={() => removeImage(index)}>
                <X size={12} />
              </button>
            </div>
          ))}
          {pendingDocs.map((doc, index) => (
            <div key={`doc-${index}`} className="attachment-preview-item doc-item">
              <FileText size={20} className="icon-muted" />
              <span className="doc-name">{doc.name}</span>
              <button className="remove-attachment" onClick={() => removeDoc(index)}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {isUploadingDocs ? (
        <div className="text-muted small mb-2">Uploading documents…</div>
      ) : null}

      {recordingState !== 'idle' ? (
        <div className="recording-indicator">
          <div className="recording-pulse"></div>
          <span className="recording-text">
            {recordingState === 'processing' ? 'Transcribing...' : `Recording ${formatTime(recordingTime)}`}
          </span>
        </div>
      ) : null}
      
      <div className="chat-input-container-modern">
        {showCommands && filteredCommands.length > 0 && (
          <div className="search-suggestions-container">
            <div className="suggestions-group">
              <div className="suggestions-group-label">Commands</div>
              {filteredCommands.map((command) => (
                <button
                  key={command.id}
                  className="suggestion-row"
                  onClick={() => {
                    command.action();
                    setShowCommands(false);
                  }}
                >
                  <span className="icon-muted">{command.icon}</span>
                  <span>{command.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showSuggestions && !showCommands && (searchSuggestions.length > 0 || recentSearches.length > 0) ? (
          <div
            className="search-suggestions-container"
          >
            {/* Search suggestions */}
            {searchSuggestions.length > 0 ? (
              <div className="suggestions-group">
                <div className="suggestions-group-label">Suggestions</div>
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="suggestion-row"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <Search size={14} className="icon-muted" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {/* Recent searches */}
            {recentSearches.length > 0 ? (
              <div className="suggestions-group">
                <div className="suggestions-group-label">Recent Searches</div>
                {recentSearches.slice(0, 5).map((query, index) => (
                  <button
                    key={index}
                    className="suggestion-row"
                    onClick={() => handleRecentSearchClick(query)}
                  >
                    <Clock size={14} className="icon-muted" />
                    <span>{query}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Unified Input Area */}
        <div className={`modern-input-box ${searchOptions.search_web ? 'search-mode' : ''} ${recordingState === 'recording' ? 'recording-active' : ''}`}>
          <div className="input-prefix">
            <div className="model-selector-container onboarding-anchor">
              <button
                className="model-select-btn"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                type="button"
                title="Select model"
              >
                <span className="model-name-text text-truncate">{selectedModel}</span>
                <ChevronDown size={14} className={`dropdown-chevron ${showModelDropdown ? 'active' : ''}`} />
              </button>

              {showOnboarding ? (
                <div className="onboarding-inline-tip">Choose a model</div>
              ) : null}
              
              {showModelDropdown && (
                <div className="model-dropdown-menu">
                  {models.map((model) => (
                    <button
                      key={model}
                      className={`model-option ${selectedModel === model ? 'active' : ''}`}
                      onClick={() => {
                        onModelSelect?.(model);
                        setShowModelDropdown(false);
                      }}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {searchOptions.search_web ? (
              <div className="onboarding-anchor">
                <button
                  className="action-icon-btn active"
                  onClick={handleWebSearchToggle}
                  title="Toggle web search"
                  type="button"
                >
                  <Globe size={18} />
                </button>
                {showOnboarding ? (
                  <div className="onboarding-inline-tip">Web search on</div>
                ) : null}
              </div>
            ) : null}
            
            {/* File Upload Button */}
            <div className="onboarding-anchor">
              <button
                className="action-icon-btn"
                onClick={handleFileClick}
                title="Upload files"
                type="button"
              >
                <Paperclip size={18} />
              </button>
              {showOnboarding ? (
                <div className="onboarding-inline-tip">Attach files</div>
              ) : null}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              multiple 
              onChange={handleFileChange}
              accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
            />

            <div className="onboarding-anchor">
              <button
                className={`action-icon-btn mic-btn ${recordingState === 'recording' ? 'recording' : ''}`}
                onClick={toggleRecording}
                title={recordingState === 'idle' ? 'Start recording' : 'Stop recording'}
                type="button"
                disabled={recordingState === 'processing'}
              >
                {recordingState === 'recording' ? (
                  <Square size={18} />
                ) : (
                  <Mic size={18} />
                )}
              </button>
              {showOnboarding ? (
                <div className="onboarding-inline-tip">Voice input</div>
              ) : null}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            className="modern-textarea"
            rows={1}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={recordingState === 'processing' ? 'Transcribing...' : 'Ask anything...'}
            disabled={recordingState === 'processing'}
          />

          <div className="input-suffix">
            <div className="onboarding-anchor">
              <button
                onClick={handleSendMessage}
                disabled={loading || isUploadingDocs || (!input.trim() && pendingImages.length === 0) || recordingState === 'processing'}
                className="send-icon-btn"
                title="Send message"
              >
                {loading ? (
                  <Loader size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
              {showOnboarding ? (
                <div className="onboarding-inline-tip">Send</div>
              ) : null}
            </div>
          </div>
        </div>
        {showOnboarding ? (
          <div className="onboarding-inline-row">
            <div className="onboarding-inline-note">Tip: type `/search` to toggle web search.</div>
            <button className="onboarding-dismiss" onClick={() => onDismissOnboarding?.()} type="button">
              Got it
            </button>
          </div>
        ) : null}
      </div>

    </div>
  );
};

export default React.memo(ChatInput);
