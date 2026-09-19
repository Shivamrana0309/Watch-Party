import { useEffect } from 'react';

export const useAttachVideoDOM = (containerRef, domElement, className = '') => {
  useEffect(() => {
    if (containerRef.current && domElement) {
      if (!containerRef.current.contains(domElement)) {
        containerRef.current.appendChild(domElement);
      }
      
      if (className) {
        domElement.className = className;
      }
      
      domElement.play().catch(() => {});
    }
    
    return () => {
      if (containerRef.current && domElement && containerRef.current.contains(domElement)) {
        containerRef.current.removeChild(domElement);
      }
    };
  }, [containerRef, domElement, className]);
};
