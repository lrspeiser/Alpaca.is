import { useState, useEffect } from 'react';
import { getProxiedImageUrl } from '../lib/imageUtils';

interface ImageDebuggerProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  onLoadInfo?: (info: ImageLoadInfo) => void;
}

export interface ImageLoadInfo {
  loaded: boolean;
  bytesLoaded: number;
  error: string | null;
  status: string;
  timeTaken: number;
  url: string;
}

/**
 * A component that measures and reports details about image loading
 * Will display the image if it loads successfully, or error information if it fails
 */
export function ImageDebugger({ src, alt, className = '', onLoadInfo }: ImageDebuggerProps) {
  // Get a proxied URL if the source is from OpenAI
  const proxiedSrc = getProxiedImageUrl(src);
  
  const [loadInfo, setLoadInfo] = useState<ImageLoadInfo>({
    loaded: false,
    bytesLoaded: 0,
    error: null,
    status: 'initializing',
    timeTaken: 0,
    url: proxiedSrc || '',
  });

  useEffect(() => {
    if (!src) {
      setLoadInfo({
        loaded: false,
        bytesLoaded: 0,
        error: 'No source URL provided',
        status: 'error',
        timeTaken: 0,
        url: '',
      });
      return;
    }

    // Reset state when src changes
    setLoadInfo({
      loaded: false,
      bytesLoaded: 0, 
      error: null,
      status: 'loading',
      timeTaken: 0,
      url: proxiedSrc || src,
    });

    // Start timer
    const startTime = performance.now();

    // Fetch the image to get detailed status
    fetch(proxiedSrc || src, { method: 'HEAD' })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        
        // Get image size if available
        const contentLength = response.headers.get('content-length');
        const contentType = response.headers.get('content-type');
        
        setLoadInfo(prev => ({
          ...prev,
          status: `head-success: ${contentType}, size=${contentLength || 'unknown'} bytes`,
        }));
        
        return fetch(proxiedSrc || src);
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        return response.blob();
      })
      .then(blob => {
        // Calculate time taken for loading
        const endTime = performance.now();
        
        setLoadInfo({
          loaded: true,
          bytesLoaded: blob.size,
          error: null,
          status: 'success',
          timeTaken: endTime - startTime,
          url: src,
        });
        
        console.log(`[IMAGE-DEBUG] Successfully loaded image (${blob.size} bytes) in ${Math.round(endTime - startTime)}ms: ${src.substring(0, 30)}...`);
      })
      .catch(error => {
        // Calculate time taken for error
        const endTime = performance.now();
        
        const errorInfo = {
          loaded: false,
          bytesLoaded: 0,
          error: error.message,
          status: 'error',
          timeTaken: endTime - startTime,
          url: src,
        };
        
        setLoadInfo(errorInfo);
        console.error(`[IMAGE-DEBUG] Error loading image: ${error.message} for ${src.substring(0, 30)}...`);
        
        if (onLoadInfo) {
          onLoadInfo(errorInfo);
        }
      });
      
  }, [src, onLoadInfo]);

  // Report status via callback when it changes
  useEffect(() => {
    if (onLoadInfo) {
      onLoadInfo(loadInfo);
    }
  }, [loadInfo, onLoadInfo]);

  // If we have a loading error, display error information
  if (loadInfo.error) {
    return (
      <div className={`image-debugger error ${className}`} style={{ 
        padding: '8px', 
        backgroundColor: '#f8d7da', 
        color: '#721c24',
        borderRadius: '4px',
        fontSize: '12px',
        textAlign: 'center',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <strong>Image Error</strong>
        <div>Status: {loadInfo.status}</div>
        <div>Error: {loadInfo.error}</div>
        <div>Time: {Math.round(loadInfo.timeTaken)}ms</div>
        <div style={{ fontSize: '10px', marginTop: '4px', wordBreak: 'break-all' }}>
          {loadInfo.url ? loadInfo.url.substring(0, 50) + '...' : 'No URL'}
        </div>
      </div>
    );
  }

  // When loading, show a placeholder
  if (!loadInfo.loaded) {
    return (
      <div className={`image-debugger loading ${className}`} style={{ 
        padding: '8px', 
        backgroundColor: '#e9ecef', 
        color: '#495057',
        borderRadius: '4px',
        fontSize: '12px',
        textAlign: 'center',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div>Loading image...</div>
        <div>Status: {loadInfo.status}</div>
        <div>URL: {loadInfo.url ? `${loadInfo.url.substring(0, 20)}...` : 'None'}</div>
      </div>
    );
  }

  // If loaded successfully, display the image
  return (
    <div className={`image-debugger ${className}`} style={{ position: 'relative' }}>
      <img
        src={src || ''}
        alt={alt}
        className={className}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{ 
        position: 'absolute', 
        bottom: 0, 
        right: 0,
        fontSize: '9px',
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        padding: '2px 4px',
        borderTopLeftRadius: '4px'
      }}>
        {Math.round(loadInfo.bytesLoaded / 1024)}KB in {Math.round(loadInfo.timeTaken)}ms
      </div>
    </div>
  );
}