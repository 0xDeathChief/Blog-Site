// Native srcset lets the browser choose a pre-generated variant without a
// second Next.js optimizer/proxy. Preserve the original Image fill geometry.
const WIDTHS = [320, 640, 1200, 1920];
const DEFAULT_SIZES = '(max-width: 760px) 100vw, 690px';
export default function ResponsiveArticleImage({ src, alt = '', className, width, height, fill = false, sizes = DEFAULT_SIZES, priority = false, maxWidth = 1920 }) {
  const widths = WIDTHS.filter(w => w <= maxWidth);
  const base = src.split('?')[0];
  const preview = w => `${base}?preview=1&w=${w}`;
  const fallback = widths.includes(640) ? 640 : widths[widths.length - 1];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-generated responsive media, no optimizer round trip
    <img src={preview(fallback)} srcSet={widths.map(w => `${preview(w)} ${w}w`).join(', ')} sizes={sizes}
      className={className} alt={alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async"
      {...(fill ? { style: { position: 'absolute', inset: 0, height: '100%', width: '100%' } } : { width, height })} />
  );
}
