import { Request, Response } from 'express';
import fetch from 'node-fetch';

/**
 * Creates a proxy for fetching images from external sources that might
 * have CORS restrictions or require special headers
 */
export async function setupImageProxy(app: any) {
  // Register the proxy endpoint
  app.get('/api/image-proxy', async (req: Request, res: Response) => {
    try {
      const imageUrl = req.query.url as string;
      
      if (!imageUrl) {
        return res.status(400).json({ error: 'No URL provided' });
      }
      
      console.log(`[IMAGE-PROXY] Attempting to proxy image: ${imageUrl.substring(0, 50)}...`);
      
      // Fetch the image from the source
      const imageResponse = await fetch(imageUrl, {
        headers: {
          // Add any necessary headers here
          'User-Agent': 'Mozilla/5.0 (compatible; BingoAppProxy/1.0)',
        },
      });
      
      if (!imageResponse.ok) {
        console.error(`[IMAGE-PROXY] Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
        return res.status(imageResponse.status).json({ 
          error: `Image fetch failed: ${imageResponse.statusText}`,
          status: imageResponse.status
        });
      }
      
      // Get the image data and content type
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const imageBuffer = await imageResponse.buffer();
      
      console.log(`[IMAGE-PROXY] Successfully proxied image (${imageBuffer.length} bytes) with content type: ${contentType}`);
      
      // Set appropriate headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      
      // Send the image data
      return res.send(imageBuffer);
    } catch (error: any) {
      console.error('[IMAGE-PROXY] Error proxying image:', error);
      return res.status(500).json({ error: 'Failed to proxy image', details: error.message });
    }
  });
  
  console.log('[IMAGE-PROXY] Image proxy endpoint setup completed at /api/image-proxy');
}