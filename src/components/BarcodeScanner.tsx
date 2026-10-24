import React, { useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Image as ImageIcon, Camera } from 'lucide-react';

interface BarcodeScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function BarcodeScanner({ onResult, onClose, title = 'Scan SNID', description = 'Take a picture of the barcode or upload an existing photo to scan the SNID.' }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIsScanning(true);
      setError(null);
      
      try {
        const html5QrCode = new Html5Qrcode("hidden-reader");
        const result = await html5QrCode.scanFile(file, false);
        onResult(result);
      } catch (err: any) {
        console.error("Failed to scan file", err);
        setError("Could not find a barcode in the image. Please try again with a clearer image.");
      } finally {
        setIsScanning(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50/90 backdrop-blur-sm">
      <div className="flex justify-between items-center p-4 bg-white border-b border-slate-200">
        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Camera className="w-5 h-5"/> {title}</h3>
        <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-600">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Hidden div for html5qrcode to use internally */}
        <div id="hidden-reader" style={{ display: 'none' }}></div>
        
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <ImageIcon className="w-10 h-10" />
          </div>
          
          <h2 className="text-xl font-bold text-slate-800 mb-2">Upload or Take Photo</h2>
          <p className="text-slate-500 mb-8">
            {description}
          </p>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 text-left">
              {error}
            </div>
          )}
          
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            onChange={handleFileChange}
            ref={fileInputRef}
            className="hidden" 
            id="barcode-image-capture"
          />

          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange}
            className="hidden" 
            id="barcode-image-upload"
          />
          
          <div className="flex flex-col gap-3">
            <label 
              htmlFor="barcode-image-capture"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              {isScanning ? 'Scanning...' : 'Take Photo'}
            </label>

            <label 
              htmlFor="barcode-image-upload"
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <ImageIcon className="w-5 h-5" />
              Upload Image
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

