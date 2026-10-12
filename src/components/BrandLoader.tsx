import { HSLogo, HSWordmark } from './HSLogo';

export function BrandLoader({ compact = false, label = 'Loading Quick Stock' }: { compact?: boolean; label?: string }) {
  return (
    <div className={`brand-loader ${compact ? 'brand-loader-compact' : ''}`} role="status" aria-live="polite">
      <div className="brand-loader-symbol" aria-hidden="true">
        <span className="brand-loader-halo" />
        {compact ? <HSLogo className="brand-loader-mark" /> : <HSWordmark className="brand-loader-wordmark" />}
      </div>
      <span className="brand-loader-caption">{label}</span>
    </div>
  );
}
