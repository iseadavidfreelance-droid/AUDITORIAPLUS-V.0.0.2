import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CameraOff, Zap, ZapOff, Scan, AlertCircle } from 'lucide-react';

interface BarcodeScannerViewportProps {
  onDetected: (barcode: string) => void;
  isScanningActive: boolean;
}

/**
 * Viewport de Video HTML5 con API nativa BarcodeDetector
 * AUDITORIAPLUS+ Mobile PDA
 */
export const BarcodeScannerViewport: React.FC<BarcodeScannerViewportProps> = ({
  onDetected,
  isScanningActive,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState<boolean>(true);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(isScanningActive);

  isScanningRef.current = isScanningActive;

  // Iniciar Stream de Cámara
  const startCamera = useCallback(async () => {
    try {
      setErrorMsg(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setHasCameraPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('[BarcodeScanner] No se pudo acceder a la cámara:', error.message);
      setHasCameraPermission(false);
      setErrorMsg('Cámara física no disponible en este dispositivo. El lector láser de hardware sigue activo.');
    }
  }, []);

  // Detener Cámara
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [stream]);

  // Alternar Linterna
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const capabilities = (track.getCapabilities?.() as any) || {};

    if (capabilities.torch) {
      try {
        await (track as any).applyConstraints({
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
      } catch (err) {
        console.warn('[BarcodeScanner] Error al alternar linterna:', err);
      }
    }
  };

  // Loop de Detección con la API Nativa BarcodeDetector
  useEffect(() => {
    // Verificar soporte de BarcodeDetector
    const supportsDetector = 'BarcodeDetector' in window;
    setHasBarcodeDetector(supportsDetector);

    if (!supportsDetector) {
      console.info('[BarcodeScanner] BarcodeDetector no nativo en este navegador.');
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Bucle de Detección de Cuadros
  useEffect(() => {
    if (!stream || !hasBarcodeDetector || !videoRef.current) return;

    let detector: any = null;
    try {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      detector = new BarcodeDetectorClass({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
      });
    } catch (err) {
      console.warn('[BarcodeScanner] No se pudo instanciar BarcodeDetector:', err);
      return;
    }

    let isDetecting = false;

    const detectLoop = async () => {
      if (!isScanningRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      if (!isDetecting) {
        isDetecting = true;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue && rawValue !== lastScannedCode) {
              setLastScannedCode(rawValue);
              // Feedback háptico nativo de vibración en PDAs
              if (navigator.vibrate) {
                navigator.vibrate(80);
              }
              onDetected(rawValue);

              // Timeout pequeño para no escanear el mismo código en ráfaga
              setTimeout(() => setLastScannedCode(null), 1500);
            }
          }
        } catch {
          // Ignorar fallos de cuadros vacíos
        } finally {
          isDetecting = false;
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectLoop);
    };

    animationFrameRef.current = requestAnimationFrame(detectLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stream, hasBarcodeDetector, onDetected, lastScannedCode]);

  return (
    <div className="relative w-full h-44 sm:h-52 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
      {/* Video Viewport */}
      {hasCameraPermission !== false ? (
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="p-4 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
          <CameraOff className="w-8 h-8 text-slate-600" />
          <span>Lector Láser de Hardware Activo (Wedge HID)</span>
          <span className="text-[10px] text-slate-500 max-w-xs">
            Apunta el escáner de la PDA al código de barras del producto.
          </span>
        </div>
      )}

      {/* Retícula de Escaneo y Línea Láser Animada */}
      {isScanningActive && hasCameraPermission !== false && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Marco Guía */}
          <div className="relative w-56 h-28 border-2 border-[#263988]/80 rounded-xl overflow-hidden shadow-2xl">
            {/* Esquinas en Verde (#009045) */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#009045]" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#009045]" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#009045]" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#009045]" />

            {/* Línea Láser Animada */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#009045] to-transparent shadow-[0_0_8px_#009045] animate-bounce mt-12" />
          </div>
        </div>
      )}

      {/* Overlay Superior de Controles (Linterna / Estado) */}
      <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-mono text-slate-200">
          <Scan className="w-3 h-3 text-[#009045] animate-pulse" />
          <span>{hasBarcodeDetector ? 'BarcodeDetector API' : 'Láser Hardware Wedge'}</span>
        </div>

        {stream && (
          <button
            type="button"
            onClick={toggleTorch}
            className="p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full border border-white/10 text-white transition cursor-pointer"
            aria-label="Linterna"
          >
            {torchOn ? <Zap className="w-4 h-4 text-amber-400 fill-amber-400" /> : <ZapOff className="w-4 h-4 text-slate-400" />}
          </button>
        )}
      </div>

      {/* Mensaje de Código Escaneado */}
      {lastScannedCode && (
        <div className="absolute bottom-2 inset-x-4 bg-[#009045] text-white text-xs font-mono font-bold py-1 px-3 rounded-lg text-center shadow-lg animate-in slide-in-from-bottom-2">
          ¡Detectado: {lastScannedCode}!
        </div>
      )}
    </div>
  );
};
