import React, { useRef, useState, useEffect } from "react";
import { Camera, RefreshCw, Check, X, Image as ImageIcon, AlertTriangle, Loader2 } from "lucide-react";

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  const [streamActive, setStreamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isDevMode, setIsDevMode] = useState(false);

  // Detect localhost to enable testing tools
  useEffect(() => {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    setIsDevMode(isLocal);
  }, []);

  // Request camera and load video stream
  const startCamera = async () => {
    setErrorMsg(null);
    setCapturedImage(null);
    setStreamActive(false);

    try {
      // Release existing streams
      stopCamera();

      const constraints = {
        video: {
          facingMode: "environment", // Request back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamActive(true);
      }
    } catch (err) {
      console.error("Camera access failed:", err);
      // Try fallback to any video input
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          setStreamActive(true);
        }
      } catch (fallbackErr) {
        setErrorMsg(
          "Camera access denied or device has no camera. Please enable camera permissions in your settings."
        );
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Snap image from current video stream frame
  const takeSnapshot = () => {
    if (!videoRef.current || !streamActive) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    
    // Maintain video aspect ratio
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext("2d");
    
    // Draw mirrored if using front camera (optional, usually rear for issues)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  // Local development file fallback selector
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCapturedImage(event.target.result);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProceed = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 select-none animate-fade-in overflow-hidden safe-bottom">
      {/* Upper navigation bar */}
      <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800 z-10">
        <h3 className="text-sm font-semibold tracking-tight uppercase text-zinc-300">
          {capturedImage ? "Verify Triage Photo" : "Live Camera Capture"}
        </h3>
        <button 
          onClick={() => { stopCamera(); onClose(); }}
          className="p-2 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main viewport */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        {errorMsg && !capturedImage && (
          <div className="p-6 text-center max-w-sm">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-pulse" />
            <p className="text-zinc-300 text-sm mb-6 leading-relaxed">{errorMsg}</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={startCamera}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl font-medium transition-all shadow"
              >
                Try Camera Again
              </button>
              
              {isDevMode && (
                <label className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 px-4 rounded-xl font-medium cursor-pointer transition-all border border-zinc-700">
                  <ImageIcon className="w-4 h-4" />
                  Dev: Upload File
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileSelect} 
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {/* Live Stream View */}
        {!capturedImage && !errorMsg && (
          <div className="relative w-full h-full flex items-center justify-center">
            <video 
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Guide overlay */}
            <div className="absolute inset-0 camera-overlay pointer-events-none flex flex-col justify-between p-12">
              <div className="flex justify-between border-t-2 border-l-2 border-emerald-500/50 w-10 h-10 rounded-tl-md"></div>
              <div className="flex justify-between border-t-2 border-r-2 border-emerald-500/50 w-10 h-10 rounded-tr-md self-end absolute top-12 right-12"></div>
              <div className="flex justify-between border-b-2 border-l-2 border-emerald-500/50 w-10 h-10 rounded-bl-md absolute bottom-12 left-12"></div>
              <div className="flex justify-between border-b-2 border-r-2 border-emerald-500/50 w-10 h-10 rounded-br-md absolute bottom-12 right-12"></div>
            </div>
            
            <p className="absolute bottom-6 text-center text-xs text-zinc-400 font-medium tracking-wide w-full bg-black/40 py-1.5 backdrop-blur-xs">
              Center the civic issue inside the frame
            </p>
          </div>
        )}

        {/* Captured Freeze View */}
        {capturedImage && (
          <div className="w-full h-full flex items-center justify-center bg-zinc-950 p-2">
            <img 
              src={capturedImage} 
              alt="Snapped issue" 
              className="max-w-full max-h-full object-contain rounded-2xl border border-zinc-800 shadow-2xl" 
            />
          </div>
        )}
      </div>

      {/* Action footer */}
      <div className="p-6 bg-zinc-900 border-t border-zinc-800 flex items-center justify-around z-10">
        {!capturedImage && streamActive ? (
          <button 
            onClick={takeSnapshot}
            className="flex items-center justify-center w-18 h-18 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-zinc-900 rounded-full transition-all border-4 border-zinc-900 ring-4 ring-emerald-600/30"
          >
            <Camera className="w-7 h-7 text-white" />
          </button>
        ) : capturedImage ? (
          <div className="flex items-center justify-between w-full max-w-xs gap-4">
            <button 
              onClick={handleRetake}
              className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 py-3.5 px-4 rounded-xl font-semibold transition-all border border-zinc-700 shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Retake
            </button>
            <button 
              onClick={handleProceed}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white py-3.5 px-4 rounded-xl font-semibold transition-all shadow-md"
            >
              <Check className="w-4 h-4" />
              Proceed
            </button>
          </div>
        ) : !errorMsg ? (
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            Initializing camera stream...
          </div>
        ) : (
          // Inactive state fallback action list on error
          isDevMode && (
            <label className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-6 rounded-xl font-medium cursor-pointer transition-all">
              <ImageIcon className="w-4 h-4" />
              Upload Image File
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileSelect} 
              />
            </label>
          )
        )}
      </div>
    </div>
  );
}
