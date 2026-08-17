/**
 * Inline SVGs from lucide-static, keyed by the same icon names the in-app
 * Help section uses (see HelpSection.jsx), plus a few extras for the site.
 */
import rocket from 'lucide-static/icons/rocket.svg?raw';
import fileText from 'lucide-static/icons/file-text.svg?raw';
import panelsTopLeft from 'lucide-static/icons/panels-top-left.svg?raw';
import folder from 'lucide-static/icons/folder.svg?raw';
import code from 'lucide-static/icons/code.svg?raw';
import layoutGrid from 'lucide-static/icons/layout-grid.svg?raw';
import share2 from 'lucide-static/icons/share-2.svg?raw';
import circleCheck from 'lucide-static/icons/circle-check.svg?raw';
import radio from 'lucide-static/icons/radio.svg?raw';
import ghost from 'lucide-static/icons/ghost.svg?raw';
import wandSparkles from 'lucide-static/icons/wand-sparkles.svg?raw';
import sparkles from 'lucide-static/icons/sparkles.svg?raw';
import ticket from 'lucide-static/icons/ticket.svg?raw';
import globe from 'lucide-static/icons/globe.svg?raw';
import keyRound from 'lucide-static/icons/key-round.svg?raw';
import play from 'lucide-static/icons/play.svg?raw';
import terminal from 'lucide-static/icons/terminal.svg?raw';
import lifeBuoy from 'lucide-static/icons/life-buoy.svg?raw';
import shield from 'lucide-static/icons/shield.svg?raw';
import messageCircle from 'lucide-static/icons/message-circle.svg?raw';
import github from 'lucide-static/icons/github.svg?raw';
import sun from 'lucide-static/icons/sun.svg?raw';
import moon from 'lucide-static/icons/moon.svg?raw';
import arrowRight from 'lucide-static/icons/arrow-right.svg?raw';
import arrowLeft from 'lucide-static/icons/arrow-left.svg?raw';
import bookOpen from 'lucide-static/icons/book-open.svg?raw';
import chevronRight from 'lucide-static/icons/chevron-right.svg?raw';
import workflow from 'lucide-static/icons/workflow.svg?raw';
import bot from 'lucide-static/icons/bot.svg?raw';
import database from 'lucide-static/icons/database.svg?raw';
import zap from 'lucide-static/icons/zap.svg?raw';

export const ICONS = {
  // Help topic icons (same keys as helpContent.js).
  rocket,
  file: fileText,
  layout: panelsTopLeft,
  folder,
  code,
  app: layoutGrid,
  share: share2,
  check: circleCheck,
  radio,
  ghost,
  wand: wandSparkles,
  sparkles,
  ticket,
  globe,
  key: keyRound,
  play,
  terminal,
  'life-buoy': lifeBuoy,
  shield,
  message: messageCircle,
  // Site chrome.
  github,
  sun,
  moon,
  'arrow-right': arrowRight,
  'arrow-left': arrowLeft,
  'book-open': bookOpen,
  'chevron-right': chevronRight,
  workflow,
  bot,
  database,
  zap,
};
