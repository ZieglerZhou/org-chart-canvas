import { useRef, useEffect } from 'react';

interface LevelPickerProps {
  visible: boolean;
  x: number;
  y: number;
  mode?: 'new' | 'change';
  currentLevel?: number;
  onSelect: (level: number) => void;
  onCancel: () => void;
}

const LEVELS = [
  { level: 1, label: '一级组织', color: '#1E3A8A', textColor: '#fff', desc: '集团/总部级' },
  { level: 2, label: '二级组织', color: '#2563EB', textColor: '#fff', desc: '中心/事业部级' },
  { level: 3, label: '三级组织', color: '#60A5FA', textColor: '#1e3a8a', desc: '部门/组级' },
  { level: 4, label: '四级组织', color: '#BFDBFE', textColor: '#1e3a8a', desc: '小组/团队级' },
];

export function LevelPicker({ visible, x, y, mode = 'new', currentLevel, onSelect, onCancel }: LevelPickerProps) {
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onCancel]);

  if (!visible) return null;

  const title = mode === 'change' ? '变更组织级别' : '选择组织级别';
  const subtitle = mode === 'change' ? '当前级别将同步变更颜色样式' : '点击空白处新建组织，请先设定级别';

  return (
    <div
      ref={ref}
      className="level-picker"
      style={{ left: x, top: y }}
    >
      <div className="level-picker-title">{title}</div>
      <div className="level-picker-subtitle">{subtitle}</div>
      <div className="level-list">
        {LEVELS.map((item) => (
          <button
            key={item.level}
            className="level-option"
            onClick={() => onSelect(item.level)}
            style={{
              background: item.color,
              color: item.textColor,
              opacity: currentLevel === item.level ? 0.5 : 1,
              cursor: currentLevel === item.level ? 'not-allowed' : 'pointer',
            }}
            disabled={currentLevel === item.level}
          >
            <span className="level-option-label">{item.label}</span>
            <span className="level-option-desc">{item.desc}</span>
          </button>
        ))}
      </div>
      <button className="level-picker-cancel" onClick={onCancel}>
        取消
      </button>
    </div>
  );
}
