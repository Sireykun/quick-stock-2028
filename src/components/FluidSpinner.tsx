import { HSLogo } from './HSLogo';

export function FluidSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`hs-inline-loader hs-inline-loader-${size}`} role="status" aria-label="Loading">
      <HSLogo aria-hidden="true" />
    </span>
  );
}
