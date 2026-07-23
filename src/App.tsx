import { ReactFlowProvider } from '@xyflow/react';
import OrgChartCanvas from './components/OrgChartCanvas';

export default function App() {
  return (
    <ReactFlowProvider>
      <OrgChartCanvas />
    </ReactFlowProvider>
  );
}