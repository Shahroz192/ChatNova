import React, { useEffect, useState, useRef } from 'react';
import { Bot, Brain, Sparkles, Zap } from 'lucide-react';

interface TypingIndicatorProps {
  darkMode: boolean;
  modelName?: string;
  animationStyle?: 'dots' | 'pulse' | 'wave' | 'bounce' | 'cognitive';
  showModel?: boolean;
  reducedMotion?: boolean;
  status?: 'thinking' | 'processing' | 'generating';
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  darkMode, 
  modelName = "AI", 
  animationStyle = 'dots',
  showModel = true,
  reducedMotion = false,
  status = 'thinking'
}) => {
  const [dotCount, setDotCount] = useState(0);
  const [pulsePhase, setPulsePhase] = useState(0);
  const [waveOffset, setWaveOffset] = useState(0);
  const animationRef = useRef<number | null>(null);

  // Model-specific styling and icons
  const getModelStyle = (modelName: string) => {
    const name = modelName.toLowerCase();
    
    if (name.includes('gemini') || name.includes('google')) {
      return {
        gradient: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
        icon: Sparkles,
        iconColor: '#4285f4'
      };
    } else if (name.includes('qwen') || name.includes('cerebras')) {
      return {
        gradient: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
        icon: Zap,
        iconColor: '#ff6b35'
      };
    } else if (name.includes('groq')) {
      return {
        gradient: 'linear-gradient(135deg, #ff4757 0%, #ff3838 100%)',
        icon: Brain,
        iconColor: '#ff4757'
      };
    }
    
    // Default style
    return {
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
      icon: Bot,
      iconColor: '#0ea5e9'
    };
  };

  const modelStyle = getModelStyle(modelName);
  const ModelIcon = modelStyle.icon;

  // Animation effects
  useEffect(() => {
    if (reducedMotion) return;

    const animate = () => {
      switch (animationStyle) {
        case 'dots':
          setDotCount(prev => (prev + 1) % 4);
          break;
        case 'pulse':
          setPulsePhase(prev => (prev + 0.1) % (2 * Math.PI));
          break;
        case 'wave':
          setWaveOffset(prev => (prev + 0.2) % (2 * Math.PI));
          break;
        case 'bounce':
          setDotCount(prev => (prev + 1) % 3);
          break;
        case 'cognitive':
          setPulsePhase(prev => (prev + 0.05) % (2 * Math.PI));
          setDotCount(prev => (prev + 1) % 3);
          break;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animationStyle, reducedMotion]);

  // Status-based messages
  const getStatusMessage = (status: string, modelName: string) => {
    switch (status) {
      case 'processing':
        return `${modelName} is processing`;
      case 'generating':
        return `${modelName} is generating response`;
      default:
        return `${modelName} is thinking`;
    }
  };

  // Render animation content based on style
  const renderAnimation = () => {
    const baseDotStyle = {
      animationDelay: '0s',
      animationDuration: '1.2s'
    };

    switch (animationStyle) {
      case 'pulse':
        return (
          <div className="typing-pulse-container">
            <div 
              className="typing-pulse"
              style={{
                transform: `scale(${1 + 0.3 * Math.sin(pulsePhase)})`,
                opacity: 0.6 + 0.4 * Math.sin(pulsePhase + Math.PI / 2)
              }}
            />
          </div>
        );

      case 'wave':
        return (
          <div className="typing-wave-container">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="typing-wave-bar"
                style={{
                  height: `${20 + 15 * Math.sin(waveOffset + i * 0.8)}px`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        );

      case 'bounce':
        return (
          <div className="typing-bounce-container">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="typing-bounce-dot"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '0.8s'
                }}
              />
            ))}
          </div>
        );

      case 'cognitive':
        return (
          <div className="typing-cognitive-container">
            <div className="cognitive-core" />
            <div className="cognitive-ring ring-1" />
            <div className="cognitive-ring ring-2" />
            <div className="cognitive-ring ring-3" />
          </div>
        );

      default: // dots
        return (
          <span className="dots">
            {Array.from({ length: 3 }, (_, i) => (
              <span 
                key={i} 
                className={`dot enhanced-dot ${dotCount > i ? 'active' : ''}`}
                style={{
                  ...baseDotStyle,
                  animationDelay: `${i * 0.2}s`
                }}
              />
            ))}
          </span>
        );
    }
  };

  return (
    <div className={`enhanced-typing-indicator ${darkMode ? 'dark' : ''}`}>
      <div className="d-flex justify-content-start mb-3">
        <div className="d-flex align-items-start">
          {/* Enhanced AI Avatar */}
          <div className={`enhanced-ai-avatar ${darkMode ? 'dark' : ''}`}>
            <div 
              className="avatar-icon-container"
              style={{ background: modelStyle.gradient }}
            >
              <ModelIcon 
                size={24} 
                className="enhanced-bot-icon" 
                style={{ color: 'white' }}
              />
            </div>
            {animationStyle === 'cognitive' && (
              <div className="cognitive-avatar-indicator" />
            )}
          </div>
          
          {/* Enhanced Typing Bubble */}
          <div className={`enhanced-typing-bubble ${darkMode ? 'dark' : ''}`}>
            <div className="typing-content-wrapper">
              {/* Status indicator */}
              <div className="typing-status">
                <div className="status-indicator" />
                <span className="status-text">
                  {getStatusMessage(status, modelName)}
                </span>
              </div>

              {/* Animation */}
              <div className="typing-animation-container">
                {renderAnimation()}
              </div>

              {/* Model indicator */}
              {showModel && (
                <div className="model-indicator" style={{ color: modelStyle.iconColor }}>
                  <ModelIcon size={14} />
                  <span>{modelName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Accessibility announcement */}
      <div 
        className="sr-only"
        aria-live="polite"
        aria-label={`${modelName} is ${status === 'thinking' ? 'thinking' : status}`}
      >
        {modelName} is {status === 'thinking' ? 'thinking' : status}
      </div>
    </div>
  );
};

export default TypingIndicator;
