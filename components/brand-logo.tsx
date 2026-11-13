type BrandLogoProps = {
  className?: string;
  alt?: string;
  decorative?: boolean;
};

/** The single official JVerse visual mark shared by web and desktop UI. */
export function BrandLogo({ className = "", alt = "JVerse AI", decorative = false }: BrandLogoProps) {
  return <img
    src="/brand/jverse-monogram.png"
    alt={decorative ? "" : alt}
    aria-hidden={decorative || undefined}
    className={`jv-official-logo ${className}`.trim()}
  />;
}
