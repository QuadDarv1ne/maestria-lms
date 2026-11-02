import Image from "next/image";

/**
 * Canonical brand mark. `/logo.svg` is the vector master copy (rounded white
 * tile + academic cap + gradient "M"); `/maestria-logo-icon.png` is its raster
 * twin, used where a bitmap is required (opengraph, PWA icons, certificates).
 */
export const LOGO_ICON_SRC = "/logo.svg";
/** Raster twin of the mark — used where SVG cannot be rendered (html2canvas). */
export const LOGO_RASTER_SRC = "/maestria-logo-icon.png";

interface LogoProps {
  /** Image source; SVG by default, pass LOGO_RASTER_SRC for canvas export. */
  src?: string;
  /** Icon edge length in CSS pixels. */
  size?: number;
  /** Render the "Maestria" wordmark next to the mark. */
  withWordmark?: boolean;
  /** Render the "by Maestro7IT" line under the wordmark. */
  withSubtitle?: boolean;
  className?: string;
  /** Classes for the wordmark block (e.g. responsive hiding in a header). */
  wordmarkClassName?: string;
  priority?: boolean;
}

export function Logo({
  src = LOGO_ICON_SRC,
  size = 36,
  withWordmark = true,
  withSubtitle = false,
  className = "",
  wordmarkClassName = "",
  priority = false,
}: LogoProps) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      {/* Served straight from /public: routing the SVG through the Next image
          optimizer would require enabling dangerouslyAllowSVG globally. */}
      <Image
        src={src}
        alt="Maestria"
        width={size}
        height={size}
        unoptimized
        priority={priority}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-lg"
      />
      {withWordmark && (
        <span className={`flex flex-col leading-tight ${wordmarkClassName}`}>
          <span
            className="font-bold text-foreground"
            style={{ fontSize: Math.max(14, Math.round(size * 0.5)) }}
          >
            Maestria
          </span>
          {withSubtitle && (
            <span
              className="text-muted-foreground leading-none"
              style={{ fontSize: Math.max(9, Math.round(size * 0.28)) }}
            >
              by Maestro7IT
            </span>
          )}
        </span>
      )}
    </span>
  );
}
