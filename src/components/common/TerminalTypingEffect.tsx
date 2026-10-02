import React, { useEffect, useRef, useState } from 'react';

interface TerminalTypingEffectProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export const TerminalTypingEffect: React.FC<TerminalTypingEffectProps> = ({
  text,
  speed = 30,
  onComplete,
  className = '',
}) => {
  const [displayText, setDisplayText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const cursorRef = useRef<NodeJS.Timeout | null>(null);
  const typingRef = useRef<NodeJS.Timeout | null>(null);
  const indexRef = useRef(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }, []);

  useEffect(() => {
    if (cursorRef.current) clearInterval(cursorRef.current);
    cursorRef.current = setInterval(() => setShowCursor((v) => !v), 530);
    return () => {
      if (cursorRef.current) clearInterval(cursorRef.current);
    };
  }, []);

  useEffect(() => {
    if (typingRef.current) clearTimeout(typingRef.current);
    indexRef.current = 0;
    setDisplayText('');

    if (reducedMotionRef.current) {
      setDisplayText(text);
      setShowCursor(false);
      onComplete?.();
      return;
    }

    const typeNext = () => {
      if (indexRef.current < text.length) {
        setDisplayText(text.slice(0, indexRef.current + 1));
        indexRef.current++;
        typingRef.current = setTimeout(typeNext, speed + Math.random() * speed * 0.3);
      } else {
        setShowCursor(false);
        onComplete?.();
      }
    };

    typingRef.current = setTimeout(typeNext, 100);

    return () => {
      if (typingRef.current) clearTimeout(typingRef.current);
    };
  }, [text, speed]);

  return (
    <span className={`font-mono text-[11px] text-cyan-300 ${className}`}>
      {displayText}
      {showCursor && <span className="animate-blink inline-block w-1.5 h-4 bg-cyan-400 ml-0.5 align-bottom" aria-hidden="true" />}
    </span>
  );
};

export default TerminalTypingEffect;