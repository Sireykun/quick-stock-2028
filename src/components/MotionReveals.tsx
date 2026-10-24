import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const surfaces = '.nova-panel, .nova-feature-card, .stock-location-grid .stock-location-tile, .stock-item-grid .stock-item-tile, .inventory-category-grid > button, .inventory-type-grid > div, .quickstock-main-content .grid > a.rounded-2xl, .inventory-setup-card .grid > div.rounded-xl, [data-motion-card]';

/** Animates a surface once as it enters view. Content stays visible if animation is unavailable. */
export function MotionReveals() {
  const location = useLocation();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const root = document.querySelector('.quickstock-main-content, .local-motion-main');
    if (!root) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        observer.unobserve(element);
        element.dataset.motionSeen = 'true';
        const siblings = element.parentElement?.children;
        const index = siblings ? Array.prototype.indexOf.call(siblings, element) : 0;
        element.animate([
          { opacity: 0.55, transform: 'translateY(16px) scale(.985)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ], { duration: 520, delay: Math.min(index, 5) * 55, easing: 'cubic-bezier(.2,.75,.25,1)' });
      });
    }, { threshold: 0.08, rootMargin: '0px 0px 28px 0px' });

    const scan = () => root.querySelectorAll<HTMLElement>(surfaces).forEach(element => {
      if (element.dataset.motionSeen || element.dataset.motionObserved || element.closest('.stock-focus-deck')) return;
      element.dataset.motionObserved = 'true';
      observer.observe(element);
    });
    scan();
    const changes = new MutationObserver(scan);
    changes.observe(root, { childList: true, subtree: true });
    return () => { changes.disconnect(); observer.disconnect(); root.querySelectorAll<HTMLElement>('[data-motion-observed]').forEach(element => delete element.dataset.motionObserved); };
  }, [location.pathname]);

  return null;
}
