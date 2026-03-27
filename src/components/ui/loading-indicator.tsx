'use client';

/**
 * Squeeze loader (ported from Tailwind + styled-jsx example).
 *
 * This repo uses MUI + Emotion; Tailwind is not wired (no PostCSS `@tailwindcss` pipeline) to avoid
 * preflight conflicts. Styling uses a CSS Module with the same motion as the reference component.
 *
 * To use Tailwind + shadcn here later: `npx shadcn@latest init`, add `postcss.config.mjs` with
 * `@tailwindcss/postcss`, then `@import "tailwindcss" prefix(ui);` in `globals.css` and prefer a
 * prefix so utilities do not collide with MUI. Shared primitives typically live in `components/ui`.
 */

import React from 'react';
import { CRM_PAGE_BG } from '@/components/Layout/crm-theme';
import styles from './loading-indicator.module.css';

export type SqueezeLoaderProps = {
  /** Size of the spinning squeeze square in pixels */
  size?: number;
  color1?: string;
  color2?: string;
  /** Spin period in seconds */
  spinDuration?: number;
  /** Squeeze cycle period in seconds */
  squeezeDuration?: number;
  className?: string;
  containerClassName?: string;
  /** Full viewport (auth / layout gates). When false, fits main column route loading. */
  fullscreen?: boolean;
  /** Shell background (defaults to CRM page background) */
  backgroundColor?: string;
  caption?: string;
  subcaption?: string;
};

export function SqueezeLoader({
  size = 60,
  color1 = '#3498db',
  color2 = '#F17336',
  spinDuration = 10,
  squeezeDuration = 3,
  className = '',
  containerClassName = '',
  fullscreen = true,
  backgroundColor = CRM_PAGE_BG,
  caption,
  subcaption,
}: SqueezeLoaderProps) {
  const containerClass = fullscreen ? styles.containerFullscreen : styles.containerInline;

  return (
    <div
      className={`${containerClass} ${containerClassName}`.trim()}
      style={{ backgroundColor }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={`${styles.inner} ${className}`.trim()}>
        <div
          className={styles.orbit}
          style={{
            width: size,
            height: size,
            animationDuration: `${spinDuration}s`,
          }}
        >
          <div
            className={styles.blob}
            style={{
              background: color1,
              animationDuration: `${squeezeDuration}s`,
            }}
          />
          <div
            className={styles.blobRound}
            style={{
              background: color2,
              animationDuration: `${squeezeDuration}s`,
              animationDelay: '-1.25s',
            }}
          />
        </div>
      </div>
      {(caption || subcaption) && (
        <div className={styles.textBlock}>
          {caption ? <p className={styles.caption}>{caption}</p> : null}
          {subcaption ? <p className={styles.subcaption}>{subcaption}</p> : null}
        </div>
      )}
    </div>
  );
}

export default SqueezeLoader;
