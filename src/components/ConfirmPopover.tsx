import { useEffect, useRef } from 'react';

interface ConfirmPopoverProps {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmPopover({
  visible,
  x,
  y,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, onCancel]);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="confirm-popover"
      style={{ left: x, top: y }}
    >
      <div className="popover-title">{title}</div>
      <div className="popover-message">{message}</div>
      <div className="popover-actions">
        <button className="btn-confirm" onClick={onConfirm}>
          确认
        </button>
        <button className="btn-cancel" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
