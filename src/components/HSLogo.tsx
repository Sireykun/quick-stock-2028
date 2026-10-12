import React from 'react';

/** Displays the user's original logo image without redrawing its artwork. */
export function HSLogo({ className = '', ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={`hs-logo-source ${className}`} role="img" aria-label="Sireykun Hout logo" {...props} />;
}

export function HSWordmark({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return <span className={`hs-wordmark-source ${compact ? 'hs-wordmark-source-compact' : ''} ${className}`} role="img" aria-label="Sireykun Hout" />;
}
