import { memo, useMemo } from 'react';
import { BaseEdge, getSmoothStepPath, useReactFlow } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { EDGE_COLORS } from '../data/initialData';
import type { OrgNodeData } from '../data/initialData';

export const SolidEdge = memo(({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) => {
  const { getNodes } = useReactFlow();
  const node = getNodes().find(n => n.id === source);
  const level = node ? (node.data as OrgNodeData).level ?? 1 : 1;
  const color = EDGE_COLORS[level] ?? '#333';

  // 四边Handle支持：根据实际 source/target 位置绘制规整折线
  const sPos = sourcePosition;
  const tPos = targetPosition;

  const [edgePath] = useMemo(() => {
    // 当上下对齐时走直线，否则走规整直角
    return getSmoothStepPath({
      sourceX, sourceY,
      targetX, targetY,
      sourcePosition: sPos,
      targetPosition: tPos,
      borderRadius: 0,
      offset: 40,
    });
  }, [sourceX, sourceY, targetX, targetY, sPos, tPos]);

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{ stroke: color, strokeWidth: 1.5 }}
      markerEnd={markerEnd}
    />
  );
});

SolidEdge.displayName = 'SolidEdge';
