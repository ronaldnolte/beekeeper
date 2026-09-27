// Sheets, dialogs and full-screen views render at the top level of the page. Inside a screen
// they would be trapped under the bottom nav, because the screen's fade-in animation creates
// its own layer (found 2026-09-27: the nav covered the apiary form's Save button).

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Overlay({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
