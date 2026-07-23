import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useStaff } from '../context/StaffContext';
import type { StaffMember } from '../data/initialData';
import { sortByPinyin, filterByPinyin } from '../utils/pinyinSearch';

interface StaffPoolProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function StaffPool({ collapsed, onToggle }: StaffPoolProps) {
  const { allStaff, setAllStaff } = useStaff();
  const [importMsg, setImportMsg] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualName, setManualName] = useState('');
  const [manualPos, setManualPos] = useState('');
  const [manualRank, setManualRank] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'position' | 'rank' | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  const selectedCount = selectedIds.size;

  const sortedFilteredStaff = useMemo(() => {
    const sorted = sortByPinyin(allStaff);
    return filterByPinyin(sorted, searchQuery);
  }, [allStaff, searchQuery]);

  // Excel import
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]]);
        const nameKey = findKey(rows[0], ['姓名', 'name', '人员姓名', 'Name']);
        const posKey = findKey(rows[0], ['岗位', '现有岗位', 'position', 'Position', '职位']);
        const rankKey = findKey(rows[0], ['职级', '岗级', 'rank', 'Rank', '级别']);
        if (!nameKey) { setImportMsg('未找到"姓名"列'); return; }
        const parsed = rows.map((row, i) => ({
          id: `staff-${Date.now()}-${i}`,
          name: (row[nameKey] ?? '').trim(),
          position: posKey ? (row[posKey] ?? '').trim() : '',
          rank: rankKey ? (row[rankKey] ?? '').trim() : '',
        })).filter(s => s.name.length > 0);
        if (!parsed.length) { setImportMsg('没有有效数据'); return; }
        setAllStaff(parsed); setSelectedIds(new Set());
        setImportMsg(`导入 ${parsed.length} 人`); setTimeout(() => setImportMsg(''), 3000);
      } catch { setImportMsg('Excel 解析失败'); }
    };
    reader.readAsArrayBuffer(file); e.target.value = '';
  }, [setAllStaff]);

  const handleAddStaff = useCallback(() => {
    const name = manualName.trim();
    if (!name) { setImportMsg('请输入姓名'); setTimeout(() => setImportMsg(''), 2000); return; }
    setAllStaff(prev => [...prev, { id: `staff-${Date.now()}-manual`, name, position: manualPos.trim(), rank: manualRank.trim() }]);
    setManualName(''); setManualPos(''); setManualRank('');
    setImportMsg(`已添加 ${name}`); setTimeout(() => setImportMsg(''), 2000);
  }, [manualName, manualPos, manualRank, setAllStaff]);

  const handleAddVacancy = useCallback(() => {
    setAllStaff(prev => [...prev, { id: `staff-${Date.now()}-vac`, name: '缺编', position: '待定', rank: '待定', isVacancy: true }]);
  }, [setAllStaff]);

  const handleManualKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddStaff(); }
  }, [handleAddStaff]);

  // 卡片字段编辑
  const handleFieldDblClick = useCallback((e: React.MouseEvent, staffId: string, field: 'name' | 'position' | 'rank', value: string) => {
    e.stopPropagation();
    setEditingId(staffId); setEditingField(field); setEditingValue(value);
  }, []);

  useEffect(() => { if (editingId && editRef.current) { editRef.current.focus(); editRef.current.select(); } }, [editingId]);

  const commitFieldEdit = useCallback(() => {
    if (editingId && editingField) {
      setAllStaff(prev => prev.map(s => s.id === editingId ? { ...s, [editingField]: editingValue.trim() || s[editingField] } : s));
    }
    setEditingId(null); setEditingField(null); setEditingValue('');
  }, [editingId, editingField, editingValue, setAllStaff]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitFieldEdit(); }
    else if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); }
  }, [commitFieldEdit]);

  const handleCardClick = useCallback((e: React.MouseEvent, staffId: string) => {
    if (editingId) return;
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds(prev => { const n = new Set(prev); n.has(staffId) ? n.delete(staffId) : n.add(staffId); return n; });
    } else { setSelectedIds(new Set([staffId])); }
  }, [editingId]);

  const handleDragStart = useCallback((e: React.DragEvent, staff: StaffMember) => {
    const sel = allStaff.filter(s => selectedIds.has(s.id));
    const payload = selectedIds.has(staff.id) && sel.length > 0 ? sel : [staff];
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  }, [allStaff, selectedIds]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json'); if (!raw) return;
    let arr: StaffMember[];
    try { const p = JSON.parse(raw); arr = Array.isArray(p) ? p : [p]; } catch { return; }
    if (!arr.length) return;
    const ids = new Set(arr.map(s => s.id));
    setAllStaff(prev => prev.map(s => ids.has(s.id) ? { ...s, assignedTo: undefined } : s));
  }, [setAllStaff]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

  const renderField = (staff: StaffMember, field: 'name' | 'position' | 'rank') => {
    const isEditingThis = editingId === staff.id && editingField === field;
    const val = staff[field] || '';
    if (isEditingThis) {
      return <input ref={editRef} className="pool-card-edit-input" value={editingValue}
        onChange={e => setEditingValue(e.target.value)} onBlur={commitFieldEdit}
        onKeyDown={handleEditKeyDown} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} />;
    }
    return <span className={field === 'name' ? 'staff-name' : field === 'position' ? 'staff-position' : 'staff-rank'}
      onDoubleClick={e => handleFieldDblClick(e, staff.id, field, val)}>{val || (field === 'rank' ? '-' : '')}</span>;
  };

  if (collapsed) {
    return (
      <div className="staff-pool-collapsed">
        <button className="pool-toggle-btn" onClick={onToggle} title="展开人员池">
          <span className="toggle-icon">{'<'}</span>
          <span className="toggle-label">人员池</span>
          <span className="toggle-count">{allStaff.length}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="staff-pool" onDrop={handleDrop} onDragOver={handleDragOver}>
      <div className="pool-header">
        <h3>人员池</h3>
        <div className="pool-header-right">
          <span className="pool-count">{allStaff.length} 人</span>
          <button className="pool-toggle-btn-inline" onClick={onToggle} title="收起">{'>'}</button>
        </div>
      </div>

      <div className="pool-actions">
        <button className="btn-import" onClick={() => fileInputRef.current?.click()}>导入 Excel</button>
        <button className="btn-vacancy" onClick={handleAddVacancy}>+ 空编</button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>

      <div className="pool-manual-add">
        <input className="manual-input" placeholder="姓名" value={manualName} onChange={e => setManualName(e.target.value)} onKeyDown={handleManualKeyDown} />
        <input className="manual-input manual-input-pos" placeholder="岗位" value={manualPos} onChange={e => setManualPos(e.target.value)} onKeyDown={handleManualKeyDown} />
        <input className="manual-input manual-input-rank" placeholder="职级" value={manualRank} onChange={e => setManualRank(e.target.value)} onKeyDown={handleManualKeyDown} />
        <button className="btn-add-staff" onClick={handleAddStaff}>添加</button>
      </div>

      <div className="pool-search">
        <input className="search-input" placeholder="搜索姓名 / 拼音 / 首字母" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>

      {selectedCount > 0 && (
        <div className="pool-selection-bar">
          已选中 <strong>{selectedCount}</strong> 人
          <button className="btn-clear-selection" onClick={() => setSelectedIds(new Set())}>清除</button>
        </div>
      )}
      {importMsg && <div className={`pool-msg ${importMsg.startsWith('导入') || importMsg.startsWith('已') ? 'pool-msg-success' : 'pool-msg-error'}`}>{importMsg}</div>}
      <div className="pool-hint">Ctrl+点击多选 | 双击字段可编辑</div>

      <div className="pool-list">
        {sortedFilteredStaff.length === 0 ? (
          <div className="pool-empty">{searchQuery ? '未找到匹配人员' : '暂无人员数据'}<br />{!searchQuery && '请导入 Excel 或手动添加'}</div>
        ) : sortedFilteredStaff.map(staff => (
          <div key={staff.id} className={`staff-card ${selectedIds.has(staff.id) ? 'selected' : ''} ${staff.assignedTo ? 'assigned' : ''} ${staff.isVacancy ? 'is-vacancy' : ''}`}
            draggable onClick={e => handleCardClick(e, staff.id)} onDragStart={e => handleDragStart(e, staff)}>
            <div className="staff-avatar">{staff.isVacancy ? '?' : staff.name.charAt(0)}</div>
            <div className="staff-info staff-info-row">
              {renderField(staff, 'name')}
              <span className="staff-sep">|</span>
              {renderField(staff, 'position')}
              <span className="staff-sep">|</span>
              {renderField(staff, 'rank')}
            </div>
            {staff.assignedTo && <div className="staff-badge-fixed">定岗</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function findKey(row: Record<string, string>, candidates: string[]): string | undefined {
  if (!row) return undefined;
  for (const key of Object.keys(row)) { for (const c of candidates) { if (key.trim().toLowerCase() === c.toLowerCase()) return key; } }
  for (const key of Object.keys(row)) { for (const c of candidates) { if (key.toLowerCase().includes(c.toLowerCase())) return key; } }
  return undefined;
}
