import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, AlertCircle, FlipHorizontal } from 'lucide-react';

const CameraCaptureModal = ({ isOpen, onClose, onCaptureConfirm }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // environment or user
  const [loadingCamera, setLoadingCamera] = useState(false);

  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setLoadingCamera(true);
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser context.");
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError("Camera permission denied. Please allow camera permissions in your browser or use File Upload.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError("No camera hardware detected on this machine. Please use File Upload instead.");
      } else {
        setCameraError(`Unable to start camera: ${err.message || 'Check browser security settings'}.`);
      }
    } finally {
      setLoadingCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (!capturedImage) return;

    // Convert dataURL to Blob
    fetch(capturedImage)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], `camera_scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCaptureConfirm(file, capturedImage);
        handleClose();
      });
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setCameraError(null);
    onClose();
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-teal-400" />
            <h3 className="font-semibold text-lg">Scan Prescription Camera</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {cameraError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center my-4">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h4 className="font-semibold text-red-900 mb-1">Camera Access Issue</h4>
              <p className="text-sm text-red-700 mb-4">{cameraError}</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Close & Use File Upload
                </button>
              </div>
            </div>
          ) : (
            <div className="relative bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center min-h-[360px]">
              {/* Live Video Preview */}
              {!capturedImage && (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-auto max-h-[460px] object-contain"
                  />
                  {/* Targeting Overlay Reticle */}
                  <div className="absolute inset-8 border-2 border-dashed border-teal-400/60 rounded-lg pointer-events-none flex flex-col justify-between p-3">
                    <div className="flex justify-between text-teal-300 text-xs font-mono">
                      <span>ALIGN PRESCRIPTION HERE</span>
                      <span>CHRONORX CDSS</span>
                    </div>
                    <div className="text-center text-teal-200 text-xs bg-slate-900/60 py-1 px-2 rounded backdrop-blur-sm self-center">
                      Ensure good lighting and avoid shadows
                    </div>
                  </div>
                </>
              )}

              {/* Captured Image Preview */}
              {capturedImage && (
                <div className="relative w-full">
                  <img
                    src={capturedImage}
                    alt="Captured Prescription"
                    className="w-full h-auto max-h-[460px] object-contain"
                  />
                  <div className="absolute top-3 left-3 bg-teal-600 text-white text-xs font-semibold px-2.5 py-1 rounded shadow">
                    Preview Ready
                  </div>
                </div>
              )}

              {/* Hidden Canvas for Frame Capture */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Loading Indicator */}
              {loadingCamera && !capturedImage && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-white gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-teal-400" />
                  <span>Connecting to camera hardware...</span>
                </div>
              )}
            </div>
          )}

          {/* Action Bar */}
          {!cameraError && (
            <div className="mt-5 flex items-center justify-between">
              <div>
                {!capturedImage && (
                  <button
                    onClick={toggleCameraFacing}
                    className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    Flip Camera ({facingMode === 'environment' ? 'Rear' : 'Front'})
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {!capturedImage ? (
                  <button
                    onClick={handleCapture}
                    disabled={loadingCamera || !stream}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium rounded-lg shadow-md flex items-center gap-2 transition"
                  >
                    <Camera className="w-4 h-4" />
                    Capture Prescription Image
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleRetake}
                      className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-lg flex items-center gap-2 transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retake
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg shadow-md flex items-center gap-2 transition"
                    >
                      <Check className="w-4 h-4" />
                      Confirm & Process Image
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCaptureModal;
