import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';

const pad = (value: number) => String(value).padStart(2, '0');

export function HomeClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="nova-clock" aria-label="Current local time">
      <div className="nova-clock-label"><Clock3 size={15} /> LOCAL TIME <span className="nova-clock-live" /> LIVE</div>
      <div className="nova-clock-time" aria-live="off">{pad(now.getHours())}<span>:</span>{pad(now.getMinutes())}</div>
      <div className="nova-clock-date">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now)}</div>
    </div>
  );
}
