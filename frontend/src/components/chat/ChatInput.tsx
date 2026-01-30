import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Search,
  Globe,
  Loader,
  Clock,
  Mic,
  Square,
  Paperclip,
  Image as ImageIcon,
  X,
  FileText
} from 'lucide-react';
import type { WebSearchOptions } from '../../types/search';
import { transcribeAudio } from '../../utils/api';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  sendMessage: (images?: string[]) => void;
  loading: boolean;
  searchOptions?: WebSearchOptions;
  onSearchOptionsChange?: (options: WebSearchOptions) => void;
  searchSuggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
  recentSearches?: string[];
  onRecentSearchSelect?: (query: string) => void;
  selectedModel: string;
  onFileUpload: (file: File) => void;
}

type RecordingState = 'idle' | 'recording' | 'processing';

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  sendMessage,
  loading,
  searchOptions = { search_web: false },
  onSearchOptionsChange,
  searchSuggestions = [],
  onSuggestionSelect,
  recentSearches = [],
  onRecentSearchSelect,
  selectedModel,
  onFileUpload
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [pendingImages, setPendingImages] = useState<{name: string, data: string}[]>([]);
  const [pendingDocs, setPendingDocs] = useState<{name: string}[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isGemini = selectedModel.toLowerCase().includes('gemini');

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleWebSearchToggle = () => {
    if (onSearchOptionsChange) {
      onSearchOptionsChange({
        ...searchOptions,
        search_web: !searchOptions.search_web
      });
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
    }
    setShowSuggestions(false);
  };

  const handleRecentSearchClick = (query: string) => {
    if (onRecentSearchSelect) {
      onRecentSearchSelect(query);
    }
    setShowSuggestions(false);
  };

  const toggleRecording = async () => {
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
            setInput(prev => prev ? `${prev} ${text}` : text);
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
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const removeImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeDoc = (index: number) => {
    setPendingDocs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = () => {
    const images = pendingImages.map(img => img.data);
    sendMessage(images);
    setPendingImages([]);
    setPendingDocs([]);
  };

  return (
    <div className="chat-input-wrapper">
      {/* Attachment Preview */}
      {(pendingImages.length > 0 || pendingDocs.length > 0) && (
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
      )}

      {recordingState !== 'idle' && (
        <div className="recording-indicator">
          <div className="recording-pulse"></div>
          <span className="recording-text">
            {recordingState === 'processing' ? 'Transcribing...' : `Recording ${formatTime(recordingTime)}`}
          </span>
        </div>
      )}
      
      <div className="chat-input-container-modern">
        {/* ... Suggestions dropdown remains the same ... */}
        {showSuggestions && (searchSuggestions.length > 0 || recentSearches.length > 0) && (
          <div
            ref={suggestionsRef}
            className="search-suggestions-container"
          >
            {/* Search suggestions */}
            {searchSuggestions.length > 0 && (
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
            )}

            {/* Recent searches */}
            {recentSearches.length > 0 && (
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
            )}
          </div>
        )}

        {/* Unified Input Area */}
        <div className={`modern-input-box ${searchOptions.search_web ? 'search-mode' : ''} ${recordingState === 'recording' ? 'recording-active' : ''}`}>
          <div className="input-prefix">
            <button
              className={`action-icon-btn ${searchOptions.search_web ? 'active' : ''}`}
              onClick={handleWebSearchToggle}
              title="Toggle web search"
              type="button"
            >
              {searchOptions.search_web ? <Globe size={18} /> : <Search size={18} />}
            </button>
            
            {/* File Upload Button */}
            <button
              className="action-icon-btn"
              onClick={handleFileClick}
              title="Upload files"
              type="button"
            >
              <Paperclip size={18} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              multiple 
              onChange={handleFileChange}
              accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
            />

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
          </div>

          <textarea
            ref={textareaRef}
            className="modern-textarea"
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(e.target.value.length > 0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
              if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            onFocus={() => {
              setShowSuggestions(true);
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            placeholder={recordingState === 'processing' ? 'Transcribing...' : 'Ask anything...'}
            disabled={recordingState === 'processing'}
          />

          <div className="input-suffix">
            <button
              onClick={handleSendMessage}
              disabled={loading || (!input.trim() && pendingImages.length === 0) || recordingState === 'processing'}
              className="send-icon-btn"
              title="Send message"
            >
              {loading ? (
                <Loader size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ChatInput;
