/**
 * Temporary fixture content for the block preview page (deleted in Task I1). It covers each
 * block's edge counts: 3 and 4 stats (with and without notes), 4 and 12 logos (with and without
 * links), a testimonial with and without a portrait, and a media split each way round (with an
 * action and a Markdown link, then reversed without either). Existing uploads stand in for logos
 * and the portrait until I1 adds the placeholder marks.
 */
import archive from '../../assets/uploads/cover-archive-search.png';
import newsroom from '../../assets/uploads/cover-newsroom-desk.png';
import playout from '../../assets/uploads/cover-playout-control.png';
import og from '../../assets/uploads/og-default.png';
import transmitter from '../../assets/uploads/transmitter.png';
import type { LogosContent, PreviewBlock } from './block-content.ts';

const LOGO_IMAGES = [archive, newsroom, playout, og, transmitter];
const PARTNER_HREF = 'https://example.com/';
/** The two walls: the fewest and the most logos a block takes; every third one is unlinked. */
const LOOSE_COUNT = 4;
const DENSE_COUNT = 12;
const UNLINKED_EVERY = 3;

function partner(n: number): LogosContent['items'][number] {
  const image = LOGO_IMAGES[n % LOGO_IMAGES.length] ?? archive;
  const alt = `Partner ${n + 1}`;
  return n % UNLINKED_EVERY === UNLINKED_EVERY - 1
    ? { image, alt }
    : { image, alt, href: `${PARTNER_HREF}partner-${n + 1}/` };
}

export const BLOCK_FIXTURES: PreviewBlock[] = [
  {
    type: 'stats',
    label: 'On air',
    items: [
      { value: '24/7', label: 'Continuous playout', note: 'Every channel, every day of the year.' },
      { value: '99.98%', label: 'Signal uptime', note: 'Measured over the last twelve months.' },
      { value: '140+', label: 'Channels served' },
    ],
  },
  {
    type: 'stats',
    label: 'By the numbers',
    items: [
      { value: '12', label: 'Countries' },
      { value: '3,200', label: 'Hours archived each month' },
      { value: '0.4 s', label: 'Glass-to-glass latency', note: 'Contribution feeds, typical.' },
      { value: '18', label: 'Years on air' },
    ],
  },
  {
    type: 'logos',
    label: 'Partners',
    heading: 'Trusted by broadcasters',
    items: Array.from({ length: LOOSE_COUNT }, (_, n) => partner(n)),
  },
  {
    type: 'logos',
    label: 'Network',
    heading: 'On the same signal chain',
    items: Array.from({ length: DENSE_COUNT }, (_, n) => partner(n)),
  },
  {
    type: 'media-split',
    label: 'Newsroom',
    heading: 'From the first draft to the on-air graphic',
    text: 'Stories, scripts and lower thirds share one rundown, so the desk and the gallery work from the same page.\n\nEvery change reaches the playout chain before the next break. Read more [about the team](/about/).',
    image: newsroom,
    imageAlt: 'A newsroom desk with monitors showing the running order.',
    action: { label: 'Request a quote', href: '/quote/' },
    reverse: false,
  },
  {
    type: 'media-split',
    label: 'Archive',
    heading: 'Every frame you aired, found in seconds',
    text: 'Clips are logged as they air. Search by face, place or spoken word, and send the result straight back to playout.',
    image: archive,
    imageAlt: 'An archive search screen listing clips by timecode.',
    reverse: true,
  },
  {
    type: 'testimonial',
    quote:
      'We moved three channels onto the new chain in a weekend, and the gallery never lost the signal once.',
    name: 'Alex Morgan',
    role: 'Head of playout',
    organization: 'Example Broadcasting',
    portrait: playout,
  },
  {
    type: 'testimonial',
    quote: 'The rundown finally matches what goes to air.',
    name: 'Sam Rivera',
    role: 'News editor',
    organization: 'Example Network',
  },
];
