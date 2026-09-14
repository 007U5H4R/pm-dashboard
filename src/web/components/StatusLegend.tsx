import React from 'react';

// The status colour key, shared by the Gantt and Workflow pages. Kept in sync with statusColor()
// in CustomGantt (Blocked overrides status; In Progress and In Review share the same blue).
const LEGEND: Array<{ label: string; hex: string }> = [
  { label: 'Done', hex: '#10b981' },
  { label: 'In Progress', hex: '#3b82f6' },
  { label: 'In Review', hex: '#3b82f6' },
  { label: 'Blocked', hex: '#ef4444' },
  { label: 'To Do', hex: '#cbd5e1' },
];

interface StatusLegendProps {
  /** Extra classes for the list wrapper — pass the surrounding text colour. */
  className?: string;
}

/** The status colour key (Done / In Progress / In Review / Blocked / To Do). Each swatch carries a
 *  black hand-drawn (#hand-rough) border to match the app's Excalidraw style; translateZ(0) keeps the
 *  SVG filter painting on first render. */
const StatusLegend: React.FC<StatusLegendProps> = ({ className = '' }) => (
  <ul className={`flex flex-wrap gap-3 text-xs ${className}`}>
    {LEGEND.map(item => (
      <li key={item.label} className="flex items-center gap-1.5">
        <span
          className="inline-block w-3.5 h-3.5 shrink-0 border-2 border-gray-900 dark:border-gray-100"
          style={{
            backgroundColor: item.hex,
            borderRadius: '5px 4px 6px 4px / 4px 6px 4px 5px',
            filter: 'url(#hand-rough)',
            transform: 'translateZ(0)',
          }}
        />
        {item.label}
      </li>
    ))}
  </ul>
);

export default StatusLegend;
