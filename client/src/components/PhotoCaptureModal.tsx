import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, ImageIcon, Upload, RefreshCw } from 'lucide-react';

interface PhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCapture: (photoDataUrl: string) => void;
  activityName: string;
}

export default function PhotoCaptureModal({ 
  isOpen, 
  onClose, 
  onPhotoCapture,
  activityName
}: PhotoCaptureModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user'); // Default to front camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      // Clean up by stopping camera when modal closes
      stopCamera();
      setCapturedPhoto(null);
    }
  }, [isOpen, facingMode]); // Also restart camera when facing mode changes

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setIsCapturing(true);
      
      // First check if the browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log("[CAMERA] getUserMedia not supported");
        setHasCamera(false);
        setIsCapturing(false);
        return;
      }
      
      // Request camera access with current facing mode
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode, // Use current camera setting
          aspectRatio: 1 // Square aspect ratio
        } 
      });
      
      setStream(mediaStream);
      
      // Connect the stream to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setIsCapturing(false);
    } catch (error) {
      console.error("[CAMERA] Error accessing camera:", error);
      setHasCamera(false);
      setIsCapturing(false);
    }
  };

  // Switch between front and back cameras
  const switchCamera = () => {
    // Stop current stream first
    stopCamera();
    
    // Toggle facing mode
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    
    // Camera will restart with new facing mode due to useEffect dependency
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video (square aspect ratio)
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    
    // Draw the current video frame to the canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Calculate the crop to center the image
    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;
    
    // Draw the video centered and cropped to square
    ctx.drawImage(
      video, 
      offsetX, offsetY, size, size, // Source crop
      0, 0, size, size // Destination (full canvas)
    );
    
    // Convert canvas to data URL
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    // Save the captured photo
    setCapturedPhoto(photoDataUrl);
    
    // Stop the camera
    stopCamera();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCapturedPhoto(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = () => {
    if (capturedPhoto) {
      // Pass the photo data URL to the callback provided by the parent component
      onPhotoCapture(capturedPhoto);
      onClose();
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-heading font-bold text-lg">
            {capturedPhoto ? 'Review Your Photo' : 'Add a Photo'}
          </h3>
          <Button 
            variant="ghost" 
            size="iconSm" 
            className="rounded-full" 
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            {capturedPhoto 
              ? 'How does your photo look? You can retake it or use this one.' 
              : `Take a photo of yourself completing "${activityName}" to add to your bingo card!`}
          </p>
          
          <div className="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden relative mb-4">
            {!hasCamera && !capturedPhoto && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
                <p className="text-gray-500">
                  Camera access is not available. Please upload a photo instead.
                </p>
              </div>
            )}
            
            {hasCamera && !capturedPhoto && (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                
                {/* Camera switch button */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-2 right-2 rounded-full bg-white/70 hover:bg-white/90 shadow-md"
                  onClick={switchCamera}
                  disabled={isCapturing}
                  title={`Switch to ${facingMode === 'user' ? 'back' : 'front'} camera`}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </>
            )}
            
            {capturedPhoto && (
              <img 
                src={capturedPhoto} 
                alt="Captured photo" 
                className="w-full h-full object-cover"
              />
            )}
            
            {isCapturing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          {/* Hidden canvas for capturing photos */}
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
          />
          
          <div className="flex flex-col space-y-2">
            {!capturedPhoto ? (
              <>
                {hasCamera && (
                  <Button 
                    className="w-full flex items-center justify-center gap-2" 
                    onClick={capturePhoto}
                    disabled={isCapturing || !stream}
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  className="w-full flex items-center justify-center gap-2" 
                  onClick={triggerFileUpload}
                >
                  <Upload className="w-4 h-4" />
                  Upload Photo
                </Button>
                
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={handleSkip}
                >
                  Skip for Now
                </Button>
              </>
            ) : (
              <>
                <Button 
                  className="w-full flex items-center justify-center gap-2" 
                  onClick={handleSavePhoto}
                >
                  Use This Photo
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setCapturedPhoto(null);
                    startCamera();
                  }}
                >
                  Retake Photo
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}