import React, { useId } from 'react';

/** Registered portrait layers keep the face still while the lips and chest move. */
export function AnimatedAvatar({ message }: { message: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="nova-avatar-rig" viewBox="0 0 1145 1374" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Animated portrait of Sireykun Hout presenting inventory alerts">
      <defs>
        <linearGradient id={`${id}-head-fade`} gradientUnits="userSpaceOnUse" x1="0" y1="540" x2="0" y2="565">
          <stop offset="0" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <mask id={`${id}-head`} maskUnits="userSpaceOnUse" x="0" y="0" width="1145" height="1374">
          <rect width="1145" height="1374" fill={`url(#${id}-head-fade)`} />
        </mask>
        <clipPath id={`${id}-chest`}><rect x="0" y="540" width="1145" height="834" /></clipPath>
        <radialGradient id={`${id}-lip-fade`}>
          <stop offset="65%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id={`${id}-lips`} maskUnits="userSpaceOnUse" x="480" y="370" width="185" height="106">
          <ellipse cx="572" cy="423" rx="92" ry="53" fill={`url(#${id}-lip-fade)`} />
        </mask>
      </defs>
      <g className="nova-avatar-chest">
        <image href="/sireykun-avatar-2d.png" width="1145" height="1374" clipPath={`url(#${id}-chest)`} />
      </g>
      <image href="/sireykun-avatar-2d.png" width="1145" height="1374" mask={`url(#${id}-head)`} />
      <image key={message} className="nova-avatar-mouth" href="/sireykun-avatar-speaking.png" width="1145" height="1374" mask={`url(#${id}-lips)`} />
    </svg>
  );
}
