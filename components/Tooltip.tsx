
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  delay = 200, 
  position = 'top',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        
        let top = 0;
        let left = 0;
        
        // Calculate coords relative to Viewport (fixed positioning)
        switch (position) {
            case 'top':
                top = rect.top - 6; 
                left = rect.left + rect.width / 2;
                break;
            case 'bottom':
                top = rect.bottom + 6;
                left = rect.left + rect.width / 2;
                break;
            case 'left':
                top = rect.top + rect.height / 2;
                left = rect.left - 6;
                break;
            case 'right':
                top = rect.top + rect.height / 2;
                left = rect.right + 6;
                break;
        }
        setCoords({ top, left });
    }
  };

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
        updatePosition();
        setIsVisible(true);
    }, delay);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Update position or close on scroll/resize
  useEffect(() => {
    if (isVisible) {
      const handleUpdate = () => {
          // Closing on scroll is cleaner than trying to track position in real-time for tooltips
          hide(); 
      };
      
      window.addEventListener('scroll', handleUpdate, true);
      window.addEventListener('resize', handleUpdate);
      
      return () => {
        window.removeEventListener('scroll', handleUpdate, true);
        window.removeEventListener('resize', handleUpdate);
      };
    }
  }, [isVisible]);

  const tooltipClasses = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  };

  return (
    <>
        <div 
          ref={triggerRef}
          className={`inline-flex ${className}`}
          onMouseEnter={show} 
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
        >
          {children}
        </div>
        {isVisible && createPortal(
            <div 
                className={`fixed z-[9999] px-2 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-200 text-[10px] font-medium rounded-[4px] shadow-xl whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150 ${tooltipClasses[position]}`}
                style={{ top: coords.top, left: coords.left }}
            >
                {content}
            </div>,
            document.body
        )}
    </>
  );
};

export default Tooltip;
