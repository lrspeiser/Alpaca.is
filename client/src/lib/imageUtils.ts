/**
 * Utility functions for handling images 
 */

/**
 * Determines if a URL is an OpenAI URL which requires proxying
 * @param url The URL to check
 * @returns True if the URL is from OpenAI
 */
export function isOpenAIUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  
  // Check if the URL includes OpenAI's domain pattern
  return url.includes('oaidalleapiprodscus.blob.core.windows.net');
}

/**
 * Converts an OpenAI URL to a proxied URL if needed
 * @param url The original URL
 * @returns A proxied URL if it's an OpenAI URL, otherwise the original URL
 */
export function getProxiedImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  
  // If it's an OpenAI URL, proxy it through our server
  if (isOpenAIUrl(url)) {
    // First check if it's already a local URL
    if (url.startsWith('/images/')) {
      return url; // Already a local/stored image
    }
    
    console.log(`Using image proxy for OpenAI URL: ${url.substring(0, 30)}...`);
    // Encode the URL to make it safe for query parameters
    const encodedUrl = encodeURIComponent(url);
    return `/api/image-proxy?url=${encodedUrl}`;
  }
  
  // Otherwise, return the original URL
  return url;
}