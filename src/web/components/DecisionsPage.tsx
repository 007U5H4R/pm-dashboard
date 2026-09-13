import React from 'react';
import type { Decision } from '../../types';
import MermaidMarkdown from './MermaidMarkdown';
import { useTheme } from '../contexts/ThemeContext';

interface DecisionsPageProps {
	decisions: Decision[];
	projectName?: string;
}

const STATUS_STYLES: Record<string, string> = {
	accepted: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
	rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
	proposed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
	superseded: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

// Compose the card body from whatever fields the decision carries. A decision-log entry keeps its
// whole body in `decision`; a native decision splits Context / Decision / Consequences / Alternatives.
const decisionMarkdown = (d: Decision): string => {
	const structured = Boolean(d.context?.trim() || d.consequences?.trim() || d.alternatives?.trim());
	if (!structured) return d.decision?.trim() || '';
	const parts: string[] = [];
	if (d.context?.trim()) parts.push(`**Context**\n\n${d.context.trim()}`);
	if (d.decision?.trim()) parts.push(`**Decision**\n\n${d.decision.trim()}`);
	if (d.alternatives?.trim()) parts.push(`**Alternatives**\n\n${d.alternatives.trim()}`);
	if (d.consequences?.trim()) parts.push(`**Consequences**\n\n${d.consequences.trim()}`);
	return parts.join('\n\n');
};

const DecisionsPage: React.FC<DecisionsPageProps> = ({ decisions, projectName }) => {
	const { theme } = useTheme();

	return (
		<div className="min-h-full">
			<div className="max-w-4xl mx-auto p-6">
				<div className="mb-6">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
						{projectName ? `${projectName} — Decisions` : 'Decisions'}
					</h1>
					<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
						{decisions.length} decision{decisions.length === 1 ? '' : 's'}, in the order they were made.
					</p>
				</div>

				{decisions.length === 0 ? (
					<div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
						<p className="text-gray-500 dark:text-gray-400">No decisions yet.</p>
						<p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
							Record load-bearing decisions in a <code>decisions.md</code> at the project root, or create them with
							the Backlog CLI.
						</p>
					</div>
				) : (
					// The left rail is the lineage line; each decision is a node + card flowing down from the one before.
					<ol className="relative ml-3 border-l-2 border-gray-200 dark:border-gray-700">
						{decisions.map((decision, index) => {
							const status = decision.status?.toLowerCase() ?? 'accepted';
							return (
								<li key={decision.id} className="relative mb-6 ml-8 last:mb-0">
									{/* Hand-drawn number node: a wobbly ink-outlined badge (shared #hand-rough filter),
									    with the digit kept crisp on top so it stays legible. */}
									<span
										className="absolute -left-[47px] top-3 flex h-7 w-7 items-center justify-center"
										aria-hidden="true"
									>
										<span
											className="absolute inset-0 border-2 border-gray-800 bg-blue-500 dark:border-gray-200"
											style={{ borderRadius: '47% 53% 48% 52% / 52% 47% 53% 48%', filter: 'url(#hand-rough)' }}
										/>
										<span className="relative text-xs font-bold text-white">{index + 1}</span>
									</span>
									<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-200 dark:border-gray-700 dark:bg-gray-800">
										<div className="mb-3 flex items-start justify-between gap-4">
											<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{decision.title}</h2>
											<span
												className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
													STATUS_STYLES[status] ?? STATUS_STYLES.superseded
												}`}
											>
												{status}
											</span>
										</div>
										<div
											className="prose prose-sm !max-w-none text-gray-700 dark:text-gray-300"
											data-color-mode={theme}
										>
											<MermaidMarkdown source={decisionMarkdown(decision)} />
										</div>
									</div>
								</li>
							);
						})}
					</ol>
				)}
			</div>
		</div>
	);
};

export default DecisionsPage;
