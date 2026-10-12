import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { InventoryList } from '../components/InventoryList';
import { ArrowLeft, ImagePlus, Warehouse } from 'lucide-react';
import { compressRoomPhoto, getRoomPhoto, saveRoomPhoto } from '../lib/roomPhotos';

export function StockLocationDetail() {
  const { locationName } = useParams();
  const sheetId = localStorage.getItem('quickStock_classesSheetId') || '';
  const decodedLocationName = locationName ? decodeURIComponent(locationName) : '';
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhotoLoading(true);
    setPhotoError(null);
    if (!sheetId || !decodedLocationName) {
      setPhotoLoading(false);
      return;
    }
    getRoomPhoto(sheetId, decodedLocationName)
      .then(value => { if (!cancelled) setPhoto(value); })
      .catch(error => { if (!cancelled) setPhotoError(error.message || 'Could not load the room photo.'); })
      .finally(() => { if (!cancelled) setPhotoLoading(false); });
    return () => { cancelled = true; };
  }, [sheetId, decodedLocationName]);

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !sheetId) return;
    setPhotoSaving(true);
    setPhotoError(null);
    try {
      const compressed = await compressRoomPhoto(file);
      await saveRoomPhoto(sheetId, decodedLocationName, compressed);
      setPhoto(compressed);
    } catch (error: any) {
      setPhotoError(error.message || 'Could not save the room photo.');
    } finally {
      setPhotoSaving(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Link 
        to="/stock-room" 
        className="inline-flex items-center gap-2 text-[13px] font-bold text-slate-500 dark:text-slate-400 hover:text-[#1A1A1A] dark:hover:text-white transition-all uppercase tracking-widest bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-800/80 px-4 py-2.5 rounded-xl backdrop-blur-md border border-white/60 dark:border-white/10 w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Stock Room
      </Link>
      <section className="stock-room-hero nova-panel" aria-label={`${decodedLocationName} room photo`}>
        <div className="stock-room-hero-copy">
          <span className="stock-room-kicker">STOCK LOCATION</span>
          <h1>{decodedLocationName}</h1>
          <p>Add a photo so anyone can recognize this room on their phone.</p>
          <label htmlFor="stock-room-photo" className={`stock-photo-button ${photoSaving ? 'stock-photo-button-disabled' : ''}`}>
            <ImagePlus size={18} /> {photoSaving ? 'Saving photo...' : photo ? 'Replace room photo' : 'Upload room photo'}
          </label>
          <input id="stock-room-photo" className="sr-only" type="file" accept="image/*" onChange={handlePhotoChange} disabled={photoSaving} aria-label="Upload room photo" />
          {photoError && <p className="stock-photo-error" role="alert">{photoError}</p>}
          <span className="stock-photo-note">Saved to your connected Google Sheet · one photo per room</span>
        </div>
        <div className="stock-room-photo">
          {photo ? <img src={photo} alt={`Stock location ${decodedLocationName}`} /> : <div className="stock-room-photo-empty"><Warehouse size={54} strokeWidth={1.3} /><span>{photoLoading ? 'Loading photo...' : 'No room photo yet'}</span></div>}
        </div>
      </section>
      <InventoryList 
        sheetId={sheetId}
        className={decodedLocationName}
        title="Items in this room"
        subtitle={decodedLocationName}
        type="stock"
        tabName="Stock Room"
      />
    </div>
  );
}
