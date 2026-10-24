# Home avatar animation

The home hero uses `AnimatedAvatar.tsx` with registered SVG image layers. The lips cycle through closed and open poses in speaking bursts, restarting for each displayed alert. The torso expands and settles over 4.2 seconds while the head stays stable. This is a silent animation, not audio lip synchronization. Reduced-motion preferences disable both animations.

The alert text continues to come from the dashboard's real inventory summary.

Assets:
- `public/sireykun-avatar-2d.png`: closed-mouth portrait, generated from the user's supplied portrait turnaround.
- `public/sireykun-avatar-speaking.png`: registered speaking frame; only the mouth area is displayed over the original portrait.

Speaking frame generated with the built-in imagegen tool. Exact prompt:

> Edit this exact 2D avatar into its speaking animation frame. Preserve the exact original 1145 by 1374 canvas, face position, hairstyle, eyes, nose, chin, suit, crossed arms, transparent background and all other pixels as closely as possible. Change ONLY the lips: part them naturally in a small open speaking vowel, with a dark mouth interior and a subtle glimpse of upper teeth. No smile, no altered pose, no head turn, no new background, no text. This image will be registered on top of the original, so the mouth must remain at the same coordinates and the same scale.
