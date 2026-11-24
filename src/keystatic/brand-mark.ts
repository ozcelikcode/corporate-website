/** The admin's sidebar mark: three stacked bands, a page of sections. Plain SVG in `currentColor`. */
import { createElement, type ReactElement } from 'react';

const MARK_SIZE = 24;
const MARK_VIEW_BOX = '0 0 24 24';
const BAND_X = 3;
const BAND_WIDTH = 18;
const BAND_HEIGHT = 4;
const BAND_RADIUS = 1;
const BAND_YS = [3, 10, 17] as const;

export function brandMark(): ReactElement {
  return createElement(
    'svg',
    { width: MARK_SIZE, height: MARK_SIZE, viewBox: MARK_VIEW_BOX, fill: 'currentColor' },
    BAND_YS.map((y) =>
      createElement('rect', {
        key: y,
        x: BAND_X,
        y,
        width: BAND_WIDTH,
        height: BAND_HEIGHT,
        rx: BAND_RADIUS,
      }),
    ),
  );
}
