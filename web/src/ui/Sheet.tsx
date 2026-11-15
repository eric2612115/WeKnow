// Sheets and boxes on Radix Dialog: a sheet rising from the bottom on a phone, a centred box on a desktop.
// Asking sheets, remember sheets and confirmations have no Close and ignore presses outside; Escape means No.

import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { t } from '../strings';

export interface SheetProps {
  open: boolean;
  /** Called when the sheet asks to close (Close, Escape, a press outside), only for closable sheets. */
  onClose?: () => void;
  /** For asking sheets: Escape counts as No. */
  onEscape?: () => void;
  title: ReactNode;
  titleIcon?: ReactNode;
  /** Shown under the title for screen readers when there is no visible body line. */
  description?: string;
  closable?: boolean;
  size?: 'normal' | 'wide' | 'full';
  tone?: 'net' | 'note' | 'device' | 'plain';
  children: ReactNode;
}

export function Sheet({ open, onClose, onEscape, title, titleIcon, description, closable = true, size = 'normal', tone = 'plain', children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closable && onClose?.()}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content
          className={`sheet ${size === 'wide' ? 'wide' : size === 'full' ? 'full' : ''}`}
          onInteractOutside={(e) => !closable && e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (!closable) {
              e.preventDefault();
              onEscape?.();
            }
          }}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="min-w-0 text-sheet font-bold tracking-[-0.03em] text-balance">
              {titleIcon && (
                <span
                  className={`mr-2 inline-block size-[1.9rem] align-[-0.35rem] [&_svg]:size-full ${
                    tone === 'net' ? 'text-net' : tone === 'note' || tone === 'device' ? 'text-go' : 'text-ink'
                  }`}
                >
                  {titleIcon}
                </span>
              )}
              {title}
            </Dialog.Title>
            {closable && (
              <Dialog.Close className="btn btn-sm shrink-0" type="button">
                {t('close')}
              </Dialog.Close>
            )}
          </div>
          {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
