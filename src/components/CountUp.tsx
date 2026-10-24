import { useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';

export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) { setDisplay(value); return; }
    const controls = animate(display, value, {
      duration: 0.85,
      ease: 'easeOut',
      onUpdate: latest => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  // Animate only when the value changes, not on every animation frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduceMotion]);

  return <span>{display.toLocaleString()}{suffix}</span>;
}
