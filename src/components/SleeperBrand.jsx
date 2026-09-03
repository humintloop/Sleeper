const base = import.meta.env.BASE_URL;

const ASSETS = {
  lockup: `${base}brand/sleeper-lockup.png`,
  mark: `${base}brand/sleeper-mark.png`,
};

/**
 * Raster brand assets generated from the selected visual direction.
 *
 * The near-black matte is intentional: both assets live only on the app's
 * canvas color, so the original cut lettering remains crisp without an SVG
 * approximation of the mark.
 */
export default function SleeperBrand({
  kind = 'lockup',
  compact = false,
  decorative = false,
  style,
  className,
}) {
  const mark = kind === 'mark';
  return (
    <img
      src={ASSETS[mark ? 'mark' : 'lockup']}
      alt={decorative ? '' : 'Sleeper'}
      aria-hidden={decorative || undefined}
      className={className}
      style={{
        display: 'block',
        width: mark ? (compact ? 34 : 92) : (compact ? 188 : 260),
        height: 'auto',
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}
