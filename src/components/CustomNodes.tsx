import { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useStaff } from '../context/StaffContext';
import type { OrgNodeData, StaffMember } from '../data/initialData';

const MAX_VISIBLE = 5;

export function OrgNode({ id, data, selected }: NodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberField, setEditMemberField] = useState<'name' | 'position' | 'rank' | null>(null);
  const [editMemberValue, setEditMemberValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const memberInputRef = useRef<HTMLInputElement>(null);
  const { setNodes } = useReactFlow();
  const { allStaff, setAllStaff } = useStaff();

  const nodeData = data as OrgNodeData;
  const level = nodeData.level ?? 1;
  const levelClass = `level-${level}`;

  const members = allStaff
    .filter(s => s.assignedTo === id)
    .sort((a, b) => {
      if (a.isVacancy && !b.isVacancy) return 1;
      if (!a.isVacancy && b.isVacancy) return -1;
      if (a.isLeader && !b.isLeader) return -1;
      if (!a.isLeader && b.isLeader) return 1;
      return 0;
    });

  const realCount = members.filter(m => !m.isVacancy).length;
  const vacancyCount = members.filter(m => m.isVacancy).length;

  // 节点内最多显示 MAX_VISIBLE-1 张，第5张变为"其余X人"展开按钮
  const showExpandBtn = members.length > MAX_VISIBLE;
  const displayMembers = isExpanded ? members : (showExpandBtn ? members.slice(0, MAX_VISIBLE - 1) : members);
  const overflowCount = members.length - (MAX_VISIBLE - 1);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsHovered(false);
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    let arr: StaffMember[];
    try { const p = JSON.parse(raw); arr = Array.isArray(p) ? p : [p]; } catch { return; }
    if (!arr.length) return;
    const ids = new Set(arr.map(s => s.id));
    setAllStaff(prev => prev.map(s => ids.has(s.id) ? { ...s, assignedTo: id } : s));
  }, [id, setAllStaff]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(nodeData.label); setIsEditing(true);
  }, [nodeData.label]);

  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);

  const commitEdit = useCallback(() => {
    const t = editValue.trim();
    if (t && t !== nodeData.label) {
      setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, label: t } } : n));
    }
    setIsEditing(false);
  }, [editValue, id, nodeData.label, setNodes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    else if (e.key === 'Escape') { e.preventDefault(); setIsEditing(false); }
  }, [commitEdit]);

  const handleNodeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (editingMemberId) return;
      const ids = selectedMemberIds;
      if (ids.size === 0) return;
      e.stopPropagation();
      setAllStaff(prev => prev.map(s => ids.has(s.id) ? { ...s, assignedTo: undefined } : s));
      setSelectedMemberIds(new Set());
    }
  }, [selectedMemberIds, editingMemberId, setAllStaff]);

  const handleMemberDoubleClick = useCallback((e: React.MouseEvent, memberId: string) => {
    e.stopPropagation();
    setAllStaff(prev => prev.map(s => s.id !== memberId ? s : { ...s, isLeader: !s.isLeader }));
  }, [setAllStaff]);

  const handleFieldDoubleClick = useCallback((e: React.MouseEvent, memberId: string, field: 'name' | 'position' | 'rank', value: string) => {
    e.stopPropagation();
    setEditingMemberId(memberId); setEditMemberField(field); setEditMemberValue(value);
  }, []);

  useEffect(() => {
    if (editingMemberId && memberInputRef.current) { memberInputRef.current.focus(); memberInputRef.current.select(); }
  }, [editingMemberId]);

  const commitMemberEdit = useCallback(() => {
    if (editingMemberId && editMemberField) {
      setAllStaff(prev => prev.map(s => s.id !== editingMemberId ? s : { ...s, [editMemberField]: editMemberValue.trim() || s[editMemberField] }));
    }
    setEditingMemberId(null); setEditMemberField(null); setEditMemberValue('');
  }, [editingMemberId, editMemberField, editMemberValue, setAllStaff]);

  const handleMemberEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitMemberEdit(); }
    else if (e.key === 'Escape') { e.preventDefault(); setEditingMemberId(null); }
  }, [commitMemberEdit]);

  const handleMemberClick = useCallback((e: React.MouseEvent, memberId: string) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelectedMemberIds(prev => { const n = new Set(prev); n.has(memberId) ? n.delete(memberId) : n.add(memberId); return n; });
    } else { setSelectedMemberIds(new Set([memberId])); }
  }, []);

  const handleMemberDragStart = useCallback((e: React.DragEvent, member: StaffMember) => {
    const sel = members.filter(m => selectedMemberIds.has(m.id));
    const payload = selectedMemberIds.has(member.id) && sel.length > 0 ? sel : [member];
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  }, [members, selectedMemberIds]);

  const renderField = (member: StaffMember, field: 'name' | 'position' | 'rank') => {
    const isEditingThis = editingMemberId === member.id && editMemberField === field;
    const val = (member[field] as string) || '';
    if (isEditingThis) {
      return (
        <input ref={memberInputRef} className="member-edit-input" value={editMemberValue}
          onChange={e => setEditMemberValue(e.target.value)} onBlur={commitMemberEdit}
          onKeyDown={handleMemberEditKeyDown} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} />
      );
    }
    const cls = field === 'name' ? 'member-card-name' : field === 'position' ? 'member-card-position' : 'member-card-rank';
    return (
      <span className={cls} onDoubleClick={e => handleFieldDoubleClick(e, member.id, field, val)}>
        {val || (field === 'rank' ? '-' : '')}
      </span>
    );
  };

  // 展开/收起组织内人员
  const handleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
  }, []);
  const handleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(false);
  }, []);

  const renderMemberCard = (m: StaffMember) => (
    <div
      key={m.id}
      className={`member-card ${selectedMemberIds.has(m.id) ? 'selected' : ''} ${m.isLeader ? 'is-leader' : ''} ${m.isVacancy ? 'is-vacancy' : ''}`}
      draggable
      onClick={e => handleMemberClick(e, m.id)}
      onDragStart={e => handleMemberDragStart(e, m)}
      onDoubleClick={e => handleMemberDoubleClick(e, m.id)}
    >
      {renderField(m, 'name')}
      <span className="member-card-sep">|</span>
      {renderField(m, 'position')}
      <span className="member-card-sep">|</span>
      {renderField(m, 'rank')}
      {m.isLeader && <span className="leader-star">★</span>}
    </div>
  );

  return (
    <div
      className={`org-node ${levelClass} ${selected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${members.length > 0 ? 'has-members' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleNodeKeyDown}
      tabIndex={0}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsHovered(true); }}
      onDragLeave={e => { e.stopPropagation(); setIsHovered(false); }}
      onDrop={handleDrop}
    >
      <Handle type="source" position={Position.Top} className="custom-handle" id="top" />
      <Handle type="source" position={Position.Right} className="custom-handle" id="right" />
      <Handle type="source" position={Position.Bottom} className="custom-handle" id="bottom" />
      <Handle type="source" position={Position.Left} className="custom-handle" id="left" />
      <Handle type="target" position={Position.Top} className="custom-handle" id="top" />
      <Handle type="target" position={Position.Right} className="custom-handle" id="right" />
      <Handle type="target" position={Position.Bottom} className="custom-handle" id="bottom" />
      <Handle type="target" position={Position.Left} className="custom-handle" id="left" />

      <div className="node-content">
        {isEditing ? (
          <input ref={inputRef} className="node-edit-input" value={editValue}
            onChange={e => setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} />
        ) : (
          <>
            <div className="node-label">{nodeData.label}</div>
            <div className="node-meta">
              <span className="node-level-badge">{level}级</span>
              {realCount > 0 && <span className="node-duty-count">{realCount}人</span>}
              {vacancyCount > 0 && <span className="node-vacancy-count">{vacancyCount}空</span>}
            </div>
          </>
        )}
      </div>

      {displayMembers.length > 0 && (
        <div className="node-members">
          {displayMembers.map(m => renderMemberCard(m))}
          {showExpandBtn && !isExpanded && (
            <div className="member-card expand-card" onClick={handleExpand}>
              <span className="expand-arrow">▼</span>
              <span className="expand-text">其余{overflowCount}人</span>
            </div>
          )}
          {isExpanded && (
            <div className="member-card collapse-card" onClick={handleCollapse}>
              <span className="collapse-arrow">▲</span>
              <span className="collapse-text">收回</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
