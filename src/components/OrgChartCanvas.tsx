import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  ConnectionMode,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, Edge, Node, NodeChange } from '@xyflow/react';
import { toPng } from 'html-to-image';
import '@xyflow/react/dist/style.css';

import { OrgNode } from './CustomNodes';
import { SolidEdge } from './CustomEdges';
import { ConfirmPopover } from './ConfirmPopover';
import { StaffPool } from './StaffPool';
import { LevelPicker } from './LevelPicker';
import { initialNodes, initialEdges, initialStaff, CANVAS_TITLE_DEFAULT } from '../data/initialData';
import type { OrgNodeData, StaffMember } from '../data/initialData';
import { StaffContext } from '../context/StaffContext';

const nodeTypes = { org: OrgNode };
const edgeTypes = { solid: SolidEdge };
const GRID_SIZE = 20;
const VERSION = 'V8.3';
const SAVE_KEY = 'org-chart-canvas-save';
const MAX_HISTORY = 50;

function snap(v: number) { return Math.round(v / GRID_SIZE) * GRID_SIZE; }
function getNodeLevel(node: Node | undefined): number {
  if (!node) return 0;
  return (node.data as OrgNodeData).level ?? 0;
}

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
  allStaff: StaffMember[];
  canvasTitle: string;
}

export default function OrgChartCanvas() {
  const [nodes, setNodes, onNodesChangeRaw] = useNodesState(initialNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const [allStaff, setAllStaff] = useState(initialStaff);
  const staffRef = useRef(allStaff);
  staffRef.current = allStaff;
  const [orphanIds, setOrphanIds] = useState<Set<string>>(new Set());
  const [pendingConn, setPendingConn] = useState<{ source: string; target: string } | null>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const flowRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  // 撤销历史
  const [history, setHistory] = useState<Snapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [poolCollapsed, setPoolCollapsed] = useState(false);
  const [levelPickerVisible, setLevelPickerVisible] = useState(false);
  const [levelPickerPos, setLevelPickerPos] = useState({ x: 0, y: 0 });
  const [pendingNodePosition, setPendingNodePosition] = useState({ x: 0, y: 0 });
  const [levelPickerMode, setLevelPickerMode] = useState<'new' | 'change'>('new');
  const [changeLevelNodeId, setChangeLevelNodeId] = useState<string | null>(null);

  // 画布标题
  const [canvasTitle, setCanvasTitle] = useState(CANVAS_TITLE_DEFAULT);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleEditValue, setTitleEditValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (errorMsg) { const t = setTimeout(() => setErrorMsg(''), 3000); return () => clearTimeout(t); } }, [errorMsg]);
  useEffect(() => { if (isEditingTitle && titleInputRef.current) { titleInputRef.current.focus(); titleInputRef.current.select(); } }, [isEditingTitle]);

  // ====== 保存 / 加载 / 撤销（必须在 onNodesChange 之前定义） ======
  const takeSnapshot = useCallback((): Snapshot => ({
    nodes: JSON.parse(JSON.stringify(nodesRef.current)),
    edges: JSON.parse(JSON.stringify(edgesRef.current)),
    allStaff: JSON.parse(JSON.stringify(staffRef.current)),
    canvasTitle,
  }), [canvasTitle]);

  const pushHistory = useCallback(() => {
    if (isUndoRedoRef.current) return;
    const snap = takeSnapshot();
    setHistory(prev => {
      const idx = historyIndexRef.current;
      const next = prev.slice(0, idx + 1);
      next.push(snap);
      if (next.length > MAX_HISTORY) next.shift();
      historyIndexRef.current = next.length - 1;
      return next;
    });
  }, [takeSnapshot]);

  const undo = useCallback(() => {
    if (historyIndexRef.current < 0) return;
    const snap = history[historyIndexRef.current];
    if (!snap) return;
    isUndoRedoRef.current = true;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setAllStaff(snap.allStaff);
    setCanvasTitle(snap.canvasTitle);
    historyIndexRef.current--;
    setHistory(prev => prev.slice(0, historyIndexRef.current + 1));
    setTimeout(() => { isUndoRedoRef.current = false; }, 100);
  }, [history, setNodes, setEdges, setAllStaff, setCanvasTitle]);

  // 保存到 localStorage
  const saveToStorage = useCallback(() => {
    const snap = takeSnapshot();
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    setErrorMsg('保存成功');
  }, [takeSnapshot]);

  // 从 localStorage 加载
  const loadFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { setErrorMsg('没有找到保存文件'); return; }
      const snap: Snapshot = JSON.parse(raw);
      isUndoRedoRef.current = true;
      setNodes(snap.nodes);
      setEdges(snap.edges);
      setAllStaff(snap.allStaff);
      setCanvasTitle(snap.canvasTitle);
      setHistory([]);
      historyIndexRef.current = -1;
      setTimeout(() => { isUndoRedoRef.current = false; }, 100);
      setErrorMsg('加载成功');
    } catch { setErrorMsg('加载失败，文件格式不正确'); }
  }, [setNodes, setEdges, setAllStaff, setCanvasTitle]);

  // 导出为 JSON 文件下载
  const exportToFile = useCallback(() => {
    const snap = takeSnapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `组织画布_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [takeSnapshot]);

  // 从 JSON 文件导入
  const importFromFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const snap: Snapshot = JSON.parse(ev.target?.result as string);
          if (!snap.nodes || !snap.edges || !snap.allStaff) throw new Error('格式错误');
          isUndoRedoRef.current = true;
          setNodes(snap.nodes);
          setEdges(snap.edges);
          setAllStaff(snap.allStaff);
          setCanvasTitle(snap.canvasTitle);
          setHistory([]);
          historyIndexRef.current = -1;
          setTimeout(() => { isUndoRedoRef.current = false; }, 100);
          setErrorMsg('导入成功');
        } catch { setErrorMsg('导入失败，文件格式不正确'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges, setAllStaff, setCanvasTitle]);

  // 初始化：尝试从 localStorage 加载
  useEffect(() => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      const snap: Snapshot = JSON.parse(raw);
      if (snap.nodes && snap.nodes.length > 0) {
        isUndoRedoRef.current = true;
        setNodes(snap.nodes);
        setEdges(snap.edges);
        setAllStaff(snap.allStaff);
        if (snap.canvasTitle) setCanvasTitle(snap.canvasTitle);
        setTimeout(() => { isUndoRedoRef.current = false; }, 100);
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动保存（防抖）
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isUndoRedoRef.current) return;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveToStorage();
    }, 60000);
    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current); };
  }, [nodes, edges, allStaff, canvasTitle, saveToStorage]);

  // Ctrl+Z 撤销
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).contentEditable === 'true') return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  // 网格对齐：拖拽结束自动吸附
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const hasDragEnd = changes.some(c => c.type === 'position' && c.position && !c.dragging);
    if (hasDragEnd) pushHistory();
    onNodesChangeRaw(
      changes.map(c => {
        if (c.type === 'position' && c.position && !c.dragging) {
          return { ...c, position: { x: snap(c.position.x), y: snap(c.position.y) } };
        }
        return c;
      })
    );
  }, [onNodesChangeRaw, pushHistory]);

  const wouldCreateCycle = useCallback((sourceId: string, targetId: string, currentEdges: Edge[]): boolean => {
    const visited = new Set<string>();
    let current = targetId;
    while (current) {
      if (current === sourceId) return true;
      if (visited.has(current)) break;
      visited.add(current);
      const parentEdge = currentEdges.find(e => e.source === current);
      if (!parentEdge) break;
      current = parentEdge.target;
    }
    return false;
  }, []);

  const recalcOrphans = useCallback((allNodes: Node[], allEdges: Edge[]) => {
    const newOrphans = new Set<string>();
    allNodes.forEach(n => {
      const hasParent = allEdges.some(e => e.source === n.id);
      const level = getNodeLevel(n);
      if (!hasParent && level !== 1) newOrphans.add(n.id);
    });
    setOrphanIds(newOrphans);
  }, []);

  useEffect(() => {
    setNodes(prev => prev.map(n => ({ ...n, className: orphanIds.has(n.id) ? 'orphan-node' : '' })));
  }, [orphanIds, setNodes]);

  // 建立连接 - 统一实线，支持多对一，不移动组织框位置，保留用户选择的端点
  const establishConnection = useCallback((source: string, target: string, sourceHandle?: string | null, targetHandle?: string | null) => {
    setEdges(prev => [
      ...prev,
      {
        id: `e-${source}-${target}-${Date.now()}`, source, target,
        sourceHandle: sourceHandle || undefined,
        targetHandle: targetHandle || undefined,
        type: 'solid', data: { edgeType: 'solid' },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#333' },
      },
    ]);
    setNodes(prev => {
      const targetNode = prev.find(n => n.id === target);
      if (!targetNode) return prev;
      const newLevel = getNodeLevel(targetNode) + 1;
      return prev.map(n => n.id === source ? { ...n, data: { ...n.data, level: newLevel } } : n);
    });
  }, [setEdges, setNodes]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    let { source: sourceId, target: targetId, sourceHandle, targetHandle } = connection;
    if (sourceId === targetId) { setErrorMsg('不能连接自身'); return; }
    const sourceNode = nodes.find(n => n.id === sourceId);
    const targetNode = nodes.find(n => n.id === targetId);
    if (!sourceNode || !targetNode) return;
    const sourceLevel = getNodeLevel(sourceNode);
    const targetLevel = getNodeLevel(targetNode);
    if (wouldCreateCycle(sourceId, targetId, edges)) { setErrorMsg('不能形成循环关系'); return; }
    // 级别强关联校验：必须相邻
    if (Math.abs(sourceLevel - targetLevel) !== 1) {
      setErrorMsg(`跨级连接不允许：${sourceLevel}级与${targetLevel}级不互为相邻级别`);
      return;
    }
    // 箭头始终从低级流向高级：若用户从高级拉向低级，交换 source/target
    if (sourceLevel < targetLevel) {
      [sourceId, targetId] = [targetId, sourceId];
      [sourceHandle, targetHandle] = [targetHandle, sourceHandle];
    }
    pushHistory();
    establishConnection(sourceId, targetId, sourceHandle, targetHandle);
  }, [nodes, edges, wouldCreateCycle, establishConnection, pushHistory]);

  const handleConfirm = useCallback(() => {
    if (pendingConn) { establishConnection(pendingConn.source, pendingConn.target); setPendingConn(null); setConfirmVisible(false); }
  }, [pendingConn, establishConnection]);
  const handleCancel = useCallback(() => { setPendingConn(null); setConfirmVisible(false); }, []);

  const onSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => { setSelectedNodeIds(sel.map(n => n.id)); }, []);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    if (confirmVisible || levelPickerVisible || isEditingTitle) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setPendingNodePosition({ x: snap(position.x), y: snap(position.y) });
    setLevelPickerPos({ x: event.clientX, y: event.clientY });
    setLevelPickerMode('new'); setLevelPickerVisible(true);
  }, [screenToFlowPosition, confirmVisible, levelPickerVisible, isEditingTitle]);

  const handleLevelSelect = useCallback((level: number) => {
    if (levelPickerMode === 'new') {
      pushHistory();
      const labels = ['', '新一级组织', '新二级组织', '新三级组织', '新四级组织'];
      setNodes(prev => [...prev, { id: `${Date.now()}`, type: 'org', position: pendingNodePosition, data: { label: labels[level], level } }]);
    } else if (levelPickerMode === 'change' && changeLevelNodeId) {
      pushHistory();
      setNodes(prev => prev.map(n => n.id === changeLevelNodeId ? { ...n, data: { ...n.data, level } } : n));
      setChangeLevelNodeId(null);
    }
    setLevelPickerVisible(false);
  }, [levelPickerMode, pendingNodePosition, setNodes, changeLevelNodeId, pushHistory]);
  const handleLevelPickerCancel = useCallback(() => { setLevelPickerVisible(false); }, []);

  const selectedSingleOrg = selectedNodeIds.length === 1 ? nodes.find(n => n.id === selectedNodeIds[0]) : undefined;
  const handleChangeLevelClick = useCallback(() => {
    if (!selectedSingleOrg) return;
    const r = document.querySelector(`[data-id="${selectedSingleOrg.id}"]`)?.getBoundingClientRect();
    setLevelPickerPos(r ? { x: r.left + r.width / 2, y: r.top } : { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setChangeLevelNodeId(selectedSingleOrg.id); setLevelPickerMode('change'); setLevelPickerVisible(true);
  }, [selectedSingleOrg]);

  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    pushHistory();
    const deletedIds = new Set(deletedNodes.map(n => n.id));
    setAllStaff(prev => prev.map(s => deletedIds.has(s.assignedTo ?? '') ? { ...s, assignedTo: undefined } : s));
    setEdges(prev => {
      const remaining = prev.filter(e => !deletedIds.has(e.source) && !deletedIds.has(e.target));
      setTimeout(() => {
        const liveNodes = nodesRef.current.filter(n => !deletedIds.has(n.id));
        recalcOrphans(liveNodes, remaining);
      }, 0);
      return remaining;
    });
  }, [recalcOrphans, setEdges, pushHistory]);

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    pushHistory();
    setEdges(prev => {
      const deletedIds = new Set(deletedEdges.map(e => e.id));
      const remaining = prev.filter(e => !deletedIds.has(e.id));
      setTimeout(() => {
        recalcOrphans(nodesRef.current, remaining);
      }, 0);
      return remaining;
    });
  }, [recalcOrphans, setEdges, pushHistory]);

  // 编辑连线端点：拖拽边端点重新连接，不移动组织框，保留端点位置
  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    if (!newConnection.source || !newConnection.target) return;
    if (newConnection.source === newConnection.target) { setErrorMsg('不能连接自身'); return; }
    const otherEdges = edgesRef.current.filter(e => e.id !== oldEdge.id);
    if (wouldCreateCycle(newConnection.source, newConnection.target, otherEdges)) { setErrorMsg('不能形成循环关系'); return; }
    const sourceNode = nodesRef.current.find(n => n.id === newConnection.source);
    const targetNode = nodesRef.current.find(n => n.id === newConnection.target);
    if (sourceNode && targetNode) {
      const sl = getNodeLevel(sourceNode);
      const tl = getNodeLevel(targetNode);
      if (Math.abs(sl - tl) !== 1) { setErrorMsg(`跨级连接不允许：${sl}级与${tl}级不互为相邻级别`); return; }
      if (sl < tl) { setErrorMsg(`连接方向错误：箭头应从低级组织(${sl}级)流向高级组织(${tl}级)`); return; }
    }
    pushHistory();
    setEdges(prev => prev.map(e => e.id === oldEdge.id ? {
      ...e,
      source: newConnection.source,
      target: newConnection.target,
      sourceHandle: newConnection.sourceHandle || undefined,
      targetHandle: newConnection.targetHandle || undefined,
    } : e));
    setNodes(prev => {
      const targetNode = prev.find(n => n.id === newConnection.target);
      if (!targetNode) return prev;
      const newLevel = getNodeLevel(targetNode) + 1;
      return prev.map(n => n.id === newConnection.source ? { ...n, data: { ...n.data, level: newLevel } } : n);
    });
    setTimeout(() => {
      recalcOrphans(nodesRef.current, edgesRef.current);
    }, 0);
  }, [wouldCreateCycle, setEdges, setNodes, recalcOrphans, pushHistory]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (confirmVisible) handleCancel(); if (levelPickerVisible) handleLevelPickerCancel(); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [confirmVisible, handleCancel, levelPickerVisible, handleLevelPickerCancel]);

  // 画布 drop：空白处回池
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/json'); if (!raw) return;
    let arr: { id: string }[];
    try { const p = JSON.parse(raw); arr = Array.isArray(p) ? p : [p]; } catch { return; }
    if (!arr.length) return;
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const currentNodes = getNodes();
    let targetNodeId: string | null = null;
    for (const node of currentNodes) {
      const w = node.measured?.width ?? 160; const h = node.measured?.height ?? 40;
      if (flowPos.x >= node.position.x && flowPos.x <= node.position.x + w && flowPos.y >= node.position.y && flowPos.y <= node.position.y + h) {
        targetNodeId = node.id; break;
      }
    }
    if (!targetNodeId) {
      const ids = new Set(arr.map(s => s.id));
      setAllStaff(prev => prev.map(s => ids.has(s.id) ? { ...s, assignedTo: undefined } : s));
    }
  }, [screenToFlowPosition, getNodes]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes('application/json')) event.preventDefault();
  }, []);

  // 标题编辑
  const handleTitleDblClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setTitleEditValue(canvasTitle); setIsEditingTitle(true);
  }, [canvasTitle]);
  const commitTitleEdit = useCallback(() => {
    const t = titleEditValue.trim();
    if (t) setCanvasTitle(t);
    setIsEditingTitle(false);
  }, [titleEditValue]);
  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitTitleEdit(); }
    else if (e.key === 'Escape') { e.preventDefault(); setIsEditingTitle(false); }
  }, [commitTitleEdit]);

  // 导出图片（含标题）
  const handleExportImage = useCallback(async () => {
    if (!flowRef.current) return;
    try {
      const dataUrl = await toPng(flowRef.current, { backgroundColor: '#f9fafb', pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${canvasTitle}_${new Date().toLocaleDateString()}.png`;
      link.href = dataUrl; link.click();
    } catch { setErrorMsg('导出图片失败'); }
  }, [canvasTitle]);

  return (
    <StaffContext.Provider value={{ allStaff, setAllStaff }}>
      <div className="org-chart-container">
        {errorMsg && <div className="error-toast">{errorMsg}</div>}

        <div className="toolbar">
          <div className="toolbar-left">
            <h2>组织架构画布</h2>
            <span className="version-badge">{VERSION}</span>
          </div>
          <div className="toolbar-actions">
            <button className="btn-undo" onClick={undo} title="撤销 (Ctrl+Z)">↩ 撤回</button>
            {selectedSingleOrg && <button className="btn-change-level" onClick={handleChangeLevelClick}>变更级别</button>}
            <button className="btn-save" onClick={saveToStorage}>💾 保存</button>
            <button className="btn-save" onClick={exportToFile}>📥 导出</button>
            <button className="btn-save" onClick={importFromFile}>📤 导入</button>
            <button className="btn-export-image" onClick={handleExportImage}>导出图片</button>
            <div className="toolbar-hint">
              <span>双击编辑名称</span><span className="divider">|</span><span>Ctrl+Z撤回</span><span className="divider">|</span><span>空白处新建</span>
            </div>
          </div>
        </div>

        <div className="main-area">
          <div className="flow-wrapper" ref={flowRef}>
            {/* 画布标题 */}
            <div className="canvas-title-overlay" ref={titleRef} onDoubleClick={handleTitleDblClick}>
              {isEditingTitle ? (
                <input ref={titleInputRef} className="canvas-title-input" value={titleEditValue}
                  onChange={e => setTitleEditValue(e.target.value)} onBlur={commitTitleEdit}
                  onKeyDown={handleTitleKeyDown} onClick={e => e.stopPropagation()} />
              ) : (
                <span className="canvas-title-text">{canvasTitle}</span>
              )}
            </div>
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onConnect={onConnect} onNodesDelete={onNodesDelete} onEdgesDelete={onEdgesDelete}
              onReconnect={onReconnect}
              onPaneClick={onPaneClick} onDrop={onDrop} onDragOver={onDragOver}
              onSelectionChange={onSelectionChange}
              nodeTypes={nodeTypes} edgeTypes={edgeTypes}
              connectionMode={ConnectionMode.Loose}
              fitView attributionPosition="bottom-right"
              deleteKeyCode={['Delete', 'Backspace']}
              snapToGrid
            >
              <Background gap={GRID_SIZE} size={1} color="#e5e7eb" />
              <Controls />
            </ReactFlow>
          </div>
          <StaffPool collapsed={poolCollapsed} onToggle={() => setPoolCollapsed(c => !c)} />
        </div>

        <ConfirmPopover visible={confirmVisible} x={popoverPos.x} y={popoverPos.y}
          title={confirmConfig.title} message={confirmConfig.message}
          onConfirm={handleConfirm} onCancel={handleCancel} />
        <LevelPicker visible={levelPickerVisible} x={levelPickerPos.x} y={levelPickerPos.y}
          mode={levelPickerMode}
          currentLevel={changeLevelNodeId ? getNodeLevel(nodes.find(n => n.id === changeLevelNodeId)) : undefined}
          onSelect={handleLevelSelect} onCancel={handleLevelPickerCancel} />
      </div>
    </StaffContext.Provider>
  );
}
