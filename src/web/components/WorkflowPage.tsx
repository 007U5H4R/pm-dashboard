import React from 'react';
import type { Document, Task } from '../../types';
import CustomGantt from './CustomGantt';
import StatusLegend from './StatusLegend';
import { computeWorkflowStages } from '../lib/workflow-stages';

interface WorkflowPageProps {
  tasks: Task[];
  docs: Document[];
  projectName: string;
}

/** The 12-stage build workflow rendered on the shared Gantt UI. Stage derivation lives in
 *  ../lib/workflow-stages so the Kanban board's Workflow view stays in sync with this page. */
const WorkflowPage: React.FC<WorkflowPageProps> = ({ tasks, docs, projectName }) => {
  const { stageTasks, percentById } = React.useMemo(
    () => computeWorkflowStages(tasks, docs),
    [tasks, docs],
  );

  return (
    <div className="p-4 min-h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{projectName} — Workflow</h1>
        <StatusLegend className="text-gray-600 dark:text-gray-400" />
      </div>
      <CustomGantt tasks={stageTasks} projectName={`${projectName} workflow`} percentById={percentById} />
    </div>
  );
};

export default WorkflowPage;
