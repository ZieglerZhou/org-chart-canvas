import type { Node, Edge } from '@xyflow/react';

export interface StaffMember {
  id: string;
  name: string;
  position: string;
  rank?: string;
  assignedTo?: string;
  isLeader?: boolean;
  isVacancy?: boolean;
}

export interface OrgNodeData extends Record<string, unknown> {
  label: string;
  level: number;
}

const GRID = 20;
function snap(v: number) { return Math.round(v / GRID) * GRID; }

// 默认仅保留一个一级组织框
export const initialNodes: Node<OrgNodeData>[] = [
  { id: '1', type: 'org', position: { x: snap(340), y: snap(60) }, data: { label: '集团总部', level: 1 } },
];

export const initialEdges: Edge[] = [];

export const initialStaff: StaffMember[] = [];

export const CANVAS_TITLE_DEFAULT = '组织画布';
export const EDGE_COLORS: Record<number, string> = {
  1: '#1E3A8A',
  2: '#2563EB',
  3: '#60A5FA',
  4: '#BFDBFE',
};
