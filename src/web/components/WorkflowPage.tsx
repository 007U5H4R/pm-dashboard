import React from 'react';
import type { Document, Task } from '../../types';
import { computeSchedule } from '../lib/schedule';
import CustomGantt from './CustomGantt';
import { BOARD_BG } from '../assets/boardBg';
import { GANTT_BACKGROUNDS } from '../assets/gantt-backgrounds';
import { useAppearance } from '../contexts/AppearanceContext';

/** One schedule unit = one hour in the Gantt views (see CustomGantt). */
const UNIT_MS = 86_400_000;

interface WorkflowPageProps {
  tasks: Task[];
  docs: Document[];
  projectName: string;
}

/** The 10-stage build workflow (global CLAUDE.md build-workflow.md). Stages 1–5 are marked done when
 * their artifact document exists; Execution reflects ticket completion; the review/deploy stages have
 * no data signal yet, so they read as not-started until marked. Rendered with the shared Gantt UI. */
// `weight` = a stage's estimated duration as a fraction of the Execution stage. Execution is the anchor
// (its duration comes from the real ticket schedule); every other stage is estimated from it, so the
// estimates scale automatically for any project — new or old — from that project's own execution length.
const STAGES: Array<{ name: string; docMatch?: RegExp; execution?: boolean; weight: number }> = [
  { name: 'Product Discovery', docMatch: /discovery/i, weight: 0.15 },
  { name: 'Solution Design', docMatch: /solution/i, weight: 0.15 },
  { name: 'UI/UX Design', docMatch: /design/i, weight: 0.2 },
  { name: 'Problem Breakdown', docMatch: /ticket/i, weight: 0.3 },
  { name: 'Technical Planning', docMatch: /implementation|plan/i, weight: 0.4 },
  { name: 'Execution', execution: true, weight: 1 },
  { name: 'Design Critique', weight: 0.25 },
  { name: 'Code Review', weight: 0.3 },
  { name: 'Security Review', weight: 0.2 },
  { name: 'Deployment', weight: 0.1 },
];

const WorkflowPage: React.FC<WorkflowPageProps> = ({ tasks, docs, projectName }) => {
  const { stageTasks, percentById } = React.useMemo(() => {
    const docTitles = docs.map(d => d.title ?? '');
    const total = tasks.length;
    const done = tasks.filter(t => t.status.trim().toLowerCase() === 'done').length;
    const execPercent = total > 0 ? Math.round((done / total) * 100) : 0;

    // Execution duration is the Execution Gantt's total timeline length: same tickets, same scheduler,
    // so the two views stay in sync. It is the span from earliest start to latest finish, in hours.
    const ticketTasks = tasks.filter(t => !t.parentTaskId);
    const execSchedule = computeSchedule(ticketTasks);
    let execHours = 1;
    if (execSchedule.tasks.length > 0) {
      const minStart = Math.min(...execSchedule.tasks.map(t => t.start.getTime()));
      const maxFinish = Math.max(...execSchedule.tasks.map(t => t.finish.getTime()));
      execHours = Math.max(1, Math.round((maxFinish - minStart) / UNIT_MS));
    }

    const stageTasks: Task[] = STAGES.map((stage, index) => {
      let status = 'To Do';
      if (stage.execution) {
        status = total === 0 ? 'To Do' : done === total ? 'Done' : done > 0 ? 'In Progress' : 'To Do';
      } else if (stage.docMatch && docTitles.some(title => stage.docMatch!.test(title))) {
        status = 'Done';
      }
      const stageHours = stage.execution ? execHours : Math.max(1, Math.round(execHours * stage.weight));
      return {
        id: `STAGE-${index + 1}`,
        title: `${index + 1}. ${stage.name}`,
        status,
        assignee: [],
        createdDate: '2026-01-01',
        labels: [`sp:${stageHours}`],
        dependencies: index > 0 ? [`STAGE-${index}`] : [],
      };
    });

    return { stageTasks, percentById: { 'STAGE-6': execPercent } };
  }, [tasks, docs]);

  const { appearance } = useAppearance();
  const ganttBgUrl = (appearance.ganttBg && GANTT_BACKGROUNDS[appearance.ganttBg]) || BOARD_BG;

  return (
    <div className="p-4 min-h-full bg-cover bg-center" style={{ backgroundImage: `url(${ganttBgUrl})` }}>
      <h1 className="mb-3 px-1 text-xl font-bold text-white">{projectName} — Workflow</h1>
      <CustomGantt tasks={stageTasks} projectName={`${projectName} workflow`} percentById={percentById} />
    </div>
  );
};

export default WorkflowPage;
