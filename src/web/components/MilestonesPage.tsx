import React, { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../lib/api";
import { buildMilestoneBuckets, collectArchivedMilestoneKeys, isDoneStatus, milestoneKey } from "../utils/milestones";
import { type Milestone, type MilestoneBucket, type Task } from "../../types";
import { createTaskSearchIndex } from "../../utils/task-search";
import MilestoneTaskRow from "./MilestoneTaskRow";
import Modal from "./Modal";
import StoredDate from "./StoredDate";

type RemoveTaskHandling = "clear" | "reassign";

const rebuildFilteredBucket = (
	bucket: MilestoneBucket,
	filteredTasks: Task[],
	statuses: string[],
): MilestoneBucket => {
	const counts: Record<string, number> = {};
	for (const status of statuses) {
		counts[status] = 0;
	}
	for (const task of filteredTasks) {
		const status = task.status ?? "";
		counts[status] = (counts[status] ?? 0) + 1;
	}

	const doneCount = filteredTasks.filter((task) => isDoneStatus(task.status)).length;
	const progress = filteredTasks.length > 0 ? Math.round((doneCount / filteredTasks.length) * 100) : 0;

	return {
		...bucket,
		tasks: filteredTasks,
		statusCounts: counts,
		total: filteredTasks.length,
		doneCount,
		progress,
	};
};

interface MilestonesPageProps {
	tasks: Task[];
	statuses: string[];
	milestoneEntities: Milestone[];
	archivedMilestones: Milestone[];
	onEditTask: (task: Task) => void;
	onRefreshData?: () => Promise<void>;
	dateFormat?: string;
}

const MilestonesPage: React.FC<MilestonesPageProps> = ({
	tasks,
	statuses,
	milestoneEntities,
	archivedMilestones,
	onEditTask,
	onRefreshData,
	dateFormat,
}) => {
	const [newMilestone, setNewMilestone] = useState("");
	const [newMilestoneDueDate, setNewMilestoneDueDate] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);
	const [expandedBuckets, setExpandedBuckets] = useState<Record<string, boolean>>({});
	const [draggedTask, setDraggedTask] = useState<Task | null>(null);
	const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
	const [showAllUnassigned, setShowAllUnassigned] = useState(false);
	const [showCompleted, setShowCompleted] = useState(false);
	const [archivingMilestoneKey, setArchivingMilestoneKey] = useState<string | null>(null);
	const [savingMilestoneKey, setSavingMilestoneKey] = useState<string | null>(null);
	const [removingMilestoneKey, setRemovingMilestoneKey] = useState<string | null>(null);
	const [editingBucket, setEditingBucket] = useState<MilestoneBucket | null>(null);
	const [editMilestoneName, setEditMilestoneName] = useState("");
	const [editMilestoneDueDate, setEditMilestoneDueDate] = useState("");
	const [removingBucket, setRemovingBucket] = useState<MilestoneBucket | null>(null);
	const [removeTaskHandling, setRemoveTaskHandling] = useState<RemoveTaskHandling>("clear");
	const [removeReassignTo, setRemoveReassignTo] = useState("");
	const [modalError, setModalError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const archivedMilestoneIds = useMemo(
		() => collectArchivedMilestoneKeys(archivedMilestones, milestoneEntities),
		[archivedMilestones, milestoneEntities],
	);
	const allMilestoneEntities = useMemo(
		() => [...milestoneEntities, ...archivedMilestones],
		[milestoneEntities, archivedMilestones],
	);
	// Only surface milestones that exist as real milestone files; drop ones implied solely by a task's
	// frontmatter so the sidebar view reflects the milestones/ folder, not ad-hoc task metadata.
	const fileBackedMilestoneKeys = useMemo(() => {
		const keys = new Set<string>();
		for (const milestone of milestoneEntities) keys.add(milestoneKey(milestone.id));
		for (const milestone of archivedMilestones) keys.add(milestoneKey(milestone.id));
		return keys;
	}, [milestoneEntities, archivedMilestones]);
	const buckets = useMemo(
		() =>
			buildMilestoneBuckets(tasks, milestoneEntities, statuses, { archivedMilestoneIds, archivedMilestones }).filter(
				(bucket) => bucket.isNoMilestone || fileBackedMilestoneKeys.has(milestoneKey(bucket.milestone)),
			),
		[tasks, milestoneEntities, statuses, archivedMilestoneIds, archivedMilestones, fileBackedMilestoneKeys],
	);
	const searchQueryTrimmed = searchQuery.trim();
	const isSearchActive = searchQueryTrimmed.length > 0;
	const visibleBuckets = useMemo(() => {
		if (!isSearchActive) {
			return buckets;
		}

		// The shared task index, so a query means here what it means in the CLI, the TUI, and the
		// rest of the web. The buckets are already loaded, so this filters them in place.
		const matchedTaskIds = new Set(
			createTaskSearchIndex(buckets.flatMap((bucket) => bucket.tasks))
				.search({ query: searchQueryTrimmed })
				.map((task) => task.id),
		);

		return buckets.map((bucket) => {
			const filteredTasks = bucket.tasks.filter((task) => matchedTaskIds.has(task.id));
			return rebuildFilteredBucket(bucket, filteredTasks, statuses);
		});
	}, [buckets, isSearchActive, searchQueryTrimmed, statuses]);

	// Separate buckets into categories and sort by ID ascending
	const { unassignedBucket, activeMilestones, completedMilestones } = useMemo(() => {
		// Sort milestones by ID ascending (oldest first - preserves the natural phase/sequence order)
		const sortByIdAsc = (a: MilestoneBucket, b: MilestoneBucket) => {
			const aMilestone = a.milestone ?? "";
			const bMilestone = b.milestone ?? "";
			const aMatch = aMilestone.match(/^m-(\d+)/);
			const bMatch = bMilestone.match(/^m-(\d+)/);
			const aNum = aMatch?.[1] ? Number.parseInt(aMatch[1], 10) : Number.MAX_SAFE_INTEGER;
			const bNum = bMatch?.[1] ? Number.parseInt(bMatch[1], 10) : Number.MAX_SAFE_INTEGER;
			return aNum - bNum;
		};

		const unassigned = visibleBuckets.find((b) => b.isNoMilestone);
		const activeWithTasks = visibleBuckets.filter((b) => !b.isNoMilestone && !b.isCompleted && b.total > 0);
		const empty = visibleBuckets.filter((b) => !b.isNoMilestone && !b.isCompleted && b.total === 0);
		const completed = visibleBuckets.filter((b) => !b.isNoMilestone && b.isCompleted);

		// Sort each group by ID ascending, then combine (active with tasks first, then empty)
		const sortedActive = [...activeWithTasks].sort(sortByIdAsc);
		const sortedEmpty = [...empty].sort(sortByIdAsc);
		const sortedCompleted = [...completed].sort(sortByIdAsc);

		return {
			unassignedBucket: unassigned,
			activeMilestones: [...sortedActive, ...sortedEmpty],
			completedMilestones: sortedCompleted,
		};
	}, [visibleBuckets]);
	const removeReassignOptions = useMemo(() => {
		const currentMilestoneId = removingBucket?.milestone;
		return milestoneEntities.filter(
			(milestone) => !currentMilestoneId || milestoneKey(milestone.id) !== milestoneKey(currentMilestoneId),
		);
	}, [milestoneEntities, removingBucket]);

	// Drag and drop handlers
	const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
		setDraggedTask(task);
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", task.id);
		// Add dragging class for visual feedback
		if (e.currentTarget instanceof HTMLElement) {
			e.currentTarget.style.opacity = "0.5";
		}
	}, []);

	const handleDragEnd = useCallback((e: React.DragEvent) => {
		setDraggedTask(null);
		setDropTargetKey(null);
		if (e.currentTarget instanceof HTMLElement) {
			e.currentTarget.style.opacity = "1";
		}
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent, bucketKey: string) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDropTargetKey(bucketKey);
	}, []);

	const handleDragLeave = useCallback(() => {
		setDropTargetKey(null);
	}, []);

	const handleDrop = useCallback(async (e: React.DragEvent, targetMilestone: string | undefined) => {
		e.preventDefault();
		setDropTargetKey(null);

		if (!draggedTask) return;

		// Don't do anything if dropping on same milestone
		if (draggedTask.milestone === targetMilestone) {
			setDraggedTask(null);
			return;
		}

		try {
			await apiClient.updateTask(draggedTask.id, { milestone: targetMilestone });
			if (onRefreshData) {
				await onRefreshData();
			}
		} catch (err) {
			console.error("Failed to update task milestone:", err);
		}

		setDraggedTask(null);
	}, [draggedTask, onRefreshData]);

	const handleNewMilestoneChange = (value: string) => {
		setNewMilestone(value);
		if (error) setError(null);
		if (success) setSuccess(null);
	};

	const closeAddModal = () => {
		setShowAddModal(false);
		setNewMilestone("");
		setNewMilestoneDueDate("");
		setError(null);
	};

	const handleAddMilestone = async (event?: React.FormEvent<HTMLFormElement>) => {
		event?.preventDefault();
		const value = newMilestone.trim();
		if (!value) {
			setError("Milestone name cannot be empty.");
			setSuccess(null);
			return;
		}

		setIsSaving(true);
		setError(null);
		setSuccess(null);
		try {
			await apiClient.createMilestone(value, undefined, newMilestoneDueDate || undefined);
			setNewMilestone("");
			setNewMilestoneDueDate("");
			setSuccess(`Added milestone "${value}"`);
			setShowAddModal(false);
			if (onRefreshData) {
				await onRefreshData();
			}
			setTimeout(() => setSuccess(null), 3000);
		} catch (err) {
			console.error("Failed to add milestone:", err);
			setError(err instanceof Error ? err.message : "Failed to add milestone.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleArchiveMilestone = useCallback(
		async (bucket: MilestoneBucket) => {
			if (!bucket.milestone) return;

			const label = bucket.label || bucket.milestone;
			const confirmed = window.confirm(
				`Archive milestone "${label}"? This moves it to backlog/archive/milestones and hides it from the milestones view.`,
			);
			if (!confirmed) return;

			setArchivingMilestoneKey(bucket.key);
			setError(null);
			setSuccess(null);
			try {
				await apiClient.archiveMilestone(bucket.milestone);
				setSuccess(`Archived milestone "${label}"`);
				if (onRefreshData) {
					await onRefreshData();
				}
				setTimeout(() => setSuccess(null), 3000);
			} catch (err) {
				console.error("Failed to archive milestone:", err);
				setError(err instanceof Error ? err.message : "Failed to archive milestone.");
			} finally {
				setArchivingMilestoneKey(null);
			}
		},
		[onRefreshData],
	);

	const findDuplicateMilestone = (title: string, currentMilestoneId?: string): Milestone | undefined => {
		const titleKey = milestoneKey(title);
		if (!titleKey) return undefined;
		return milestoneEntities.find((milestone) => {
			if (currentMilestoneId && milestoneKey(milestone.id) === milestoneKey(currentMilestoneId)) {
				return false;
			}
			return milestoneKey(milestone.title) === titleKey || milestoneKey(milestone.id) === titleKey;
		});
	};

	const openEditModal = (bucket: MilestoneBucket) => {
		if (!bucket.milestone) return;
		setEditingBucket(bucket);
		setEditMilestoneName(bucket.label || bucket.milestone);
		const milestone = milestoneEntities.find((candidate) => milestoneKey(candidate.id) === milestoneKey(bucket.milestone));
		setEditMilestoneDueDate(milestone?.dueDate ?? "");
		setModalError(null);
		setError(null);
		setSuccess(null);
	};

	const closeEditModal = () => {
		setEditingBucket(null);
		setEditMilestoneName("");
		setEditMilestoneDueDate("");
		setModalError(null);
	};

	const handleEditMilestoneNameChange = (value: string) => {
		setEditMilestoneName(value);
		if (modalError) setModalError(null);
		if (error) setError(null);
		if (success) setSuccess(null);
	};

	const handleUpdateMilestone = async (event?: React.FormEvent<HTMLFormElement>) => {
		event?.preventDefault();
		const bucket = editingBucket;
		if (!bucket?.milestone) return;

		const value = editMilestoneName.trim();
		if (!value) {
			setModalError("Milestone name cannot be empty.");
			return;
		}

		const duplicate = findDuplicateMilestone(value, bucket.milestone);
		if (duplicate) {
			setModalError(`Milestone "${duplicate.title}" already exists.`);
			return;
		}

		const previousLabel = bucket.label || bucket.milestone;
		setSavingMilestoneKey(bucket.key);
		setModalError(null);
		setError(null);
		setSuccess(null);
		try {
			await apiClient.updateMilestone(bucket.milestone, value, editMilestoneDueDate || null);
			closeEditModal();
			setSuccess(previousLabel === value ? `Updated milestone "${value}"` : `Renamed milestone "${previousLabel}" to "${value}"`);
			if (onRefreshData) {
				await onRefreshData();
			}
			setTimeout(() => setSuccess(null), 3000);
		} catch (err) {
			console.error("Failed to update milestone:", err);
			setModalError(err instanceof Error ? err.message : "Failed to update milestone.");
		} finally {
			setSavingMilestoneKey(null);
		}
	};

	const openRemoveModal = (bucket: MilestoneBucket) => {
		if (!bucket.milestone) return;
		const fallbackMilestone = milestoneEntities.find(
			(milestone) => milestoneKey(milestone.id) !== milestoneKey(bucket.milestone),
		);
		setRemovingBucket(bucket);
		setRemoveTaskHandling("clear");
		setRemoveReassignTo(fallbackMilestone?.id ?? "");
		setModalError(null);
		setError(null);
		setSuccess(null);
	};

	const closeRemoveModal = () => {
		setRemovingBucket(null);
		setRemoveTaskHandling("clear");
		setRemoveReassignTo("");
		setModalError(null);
	};

	const handleRemoveMilestone = async () => {
		const bucket = removingBucket;
		if (!bucket?.milestone) return;
		const selectedTaskHandling = removeTaskHandling;
		const selectedReassignTo = removeReassignTo.trim();
		if (selectedTaskHandling === "reassign" && !selectedReassignTo) {
			setModalError("Choose a milestone to reassign tasks to.");
			return;
		}

		const label = bucket.label || bucket.milestone;
		setRemovingMilestoneKey(bucket.key);
		setModalError(null);
		setError(null);
		setSuccess(null);
		try {
			await apiClient.removeMilestone(bucket.milestone, {
				taskHandling: selectedTaskHandling,
				reassignTo: selectedTaskHandling === "reassign" ? selectedReassignTo : undefined,
			});
			closeRemoveModal();
			setSuccess(
				selectedTaskHandling === "reassign"
					? `Removed milestone "${label}" and reassigned its tasks`
					: `Removed milestone "${label}" and left its tasks unassigned`,
			);
			if (onRefreshData) {
				await onRefreshData();
			}
			setTimeout(() => setSuccess(null), 3000);
		} catch (err) {
			console.error("Failed to remove milestone:", err);
			setModalError(err instanceof Error ? err.message : "Failed to remove milestone.");
		} finally {
			setRemovingMilestoneKey(null);
		}
	};

	const getStatusBadgeClass = (status?: string | null) => {
		const normalized = (status ?? "").toLowerCase();
		if (normalized.includes("done") || normalized.includes("complete")) {
			return "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300";
		}
		if (normalized.includes("progress")) {
			return "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300";
		}
		return "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
	};

	const getPriorityBadgeClass = (priority?: string) => {
		switch (priority?.toLowerCase()) {
			case "high":
				return "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300";
			case "medium":
				return "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300";
			case "low":
				return "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300";
			default:
				return "";
		}
	};

	const getStatusDotColor = (status?: string | null) => {
		const normalized = (status ?? "").toLowerCase();
		if (normalized.includes("done") || normalized.includes("complete")) return "#10b981";
		if (normalized.includes("progress")) return "#3b82f6";
		return "#6b7280";
	};

	const getInlineStatusClass = (status: string) => {
		const normalized = status.toLowerCase();
		if (normalized.includes("done") || normalized.includes("complete")) return "text-emerald-700 dark:text-emerald-300";
		if (normalized.includes("progress")) return "text-blue-700 dark:text-blue-300";
		return "text-gray-600 dark:text-gray-400";
	};

	const getSortedTasks = (bucketTasks: Task[]) => {
		return bucketTasks.slice().sort((a, b) => {
			// Done tasks go to the bottom
			const aDone = isDoneStatus(a.status);
			const bDone = isDoneStatus(b.status);
			if (aDone !== bDone) return aDone ? 1 : -1;
			// Sort by created date descending (newest first)
			const aDate = a.createdDate ?? "";
			const bDate = b.createdDate ?? "";
			return bDate.localeCompare(aDate);
		});
	};

	const safeIdSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");

	// A Plane-style segmented status meter: one wobbly ink-outlined pill, a coloured segment per
	// status, ordered most-complete first so the green grows from the left like a progress bar.
	const statusMeterRank = (status: string) => {
		const normalized = status.toLowerCase();
		if (normalized.includes("done") || normalized.includes("complete")) return 0;
		if (normalized.includes("review")) return 1;
		if (normalized.includes("progress")) return 2;
		return 3;
	};

	const renderStatusMeter = (bucket: MilestoneBucket) => {
		const segments = statuses
			.filter((status) => (bucket.statusCounts[status] ?? 0) > 0)
			.sort((a, b) => statusMeterRank(a) - statusMeterRank(b));
		return (
			<div
				className="relative flex h-3 w-full overflow-hidden border-2 border-gray-800 dark:border-gray-200 bg-transparent"
				style={{ borderRadius: "999px", filter: "url(#hand-rough)" }}
			>
				{segments.map((status) => (
					<div
						key={status}
						className="h-full transition-all duration-300"
						style={{
							width: `${((bucket.statusCounts[status] ?? 0) / bucket.total) * 100}%`,
							backgroundColor: getStatusDotColor(status),
						}}
					/>
				))}
			</div>
		);
	};

	// Render one milestone as a compact ledger row (also a drop target); expand it for actions + tasks.
	const renderMilestoneRow = (bucket: MilestoneBucket, seq: number) => {
		const isEmpty = bucket.total === 0;
		const progress = isEmpty ? 0 : Math.round((bucket.doneCount / bucket.total) * 100);
		const isExpanded = expandedBuckets[bucket.key] ?? false;
		const listId = `milestone-${safeIdSegment(bucket.key)}`;
		const sortedTasks = getSortedTasks(bucket.tasks);
		const isDropTarget = dropTargetKey === bucket.key;
		const isDragging = draggedTask !== null;
		const isArchiving = archivingMilestoneKey === bucket.key;
		const isSavingMilestone = savingMilestoneKey === bucket.key;
		const isRemoving = removingMilestoneKey === bucket.key;
		const milestoneEntity = allMilestoneEntities.find(
			(milestone) => milestoneKey(milestone.id) === milestoneKey(bucket.milestone ?? ""),
		);
		// The sequence node echoes the Decisions-page lineage badge: complete = green, in-flight =
		// amber, not-started = grey.
		const nodeColor = bucket.isCompleted ? "#10b981" : isEmpty ? "#94a3b8" : "#d97706";

		return (
			<div
				key={bucket.key}
				className={`border-b-2 border-dashed border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors duration-200 ${
					isDropTarget
						? "bg-amber-50 dark:bg-amber-900/15"
						: isDragging
						? "bg-gray-50/60 dark:bg-gray-800/40"
						: ""
				}`}
				onDragOver={(e) => handleDragOver(e, bucket.key)}
				onDragLeave={handleDragLeave}
				onDrop={(e) => handleDrop(e, bucket.milestone)}
			>
				{/* Compact row — click to expand */}
				<button
					type="button"
					aria-expanded={isExpanded}
					aria-controls={listId}
					onClick={() => setExpandedBuckets((c) => ({ ...c, [bucket.key]: !isExpanded }))}
					className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/70 dark:hover:bg-gray-700/30 transition-colors"
				>
					{/* Hand-drawn sequence node */}
					<span className="relative flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden="true">
						<span
							className="absolute inset-0 border-2 border-gray-800 dark:border-gray-200"
							style={{
								borderRadius: "47% 53% 48% 52% / 52% 47% 53% 48%",
								backgroundColor: nodeColor,
								filter: "url(#hand-rough)",
							}}
						/>
						<span className="relative text-xs font-bold text-white">{seq}</span>
					</span>

					{/* Name + meta + meter */}
					<span className="min-w-0 flex-1">
						<span className="excali-hand block truncate text-base font-bold text-gray-900 dark:text-gray-100">
							{bucket.label}
						</span>
						<span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
							{bucket.milestone ? `${bucket.milestone.toUpperCase()} · ` : ""}
							{isEmpty ? "No tasks" : `${bucket.total} task${bucket.total === 1 ? "" : "s"}`}
							{milestoneEntity?.dueDate && (
								<>
									{" · Due "}
									<StoredDate value={milestoneEntity.dueDate} dateFormat={dateFormat} />
								</>
							)}
						</span>
						<span className="mt-2 block">{renderStatusMeter(bucket)}</span>
					</span>

					{/* Percentage */}
					<span
						className={`excali-hand shrink-0 text-xl font-bold tabular-nums ${
							progress === 100
								? "text-emerald-600 dark:text-emerald-400"
								: "text-gray-700 dark:text-gray-200"
						}`}
					>
						{isEmpty ? "—" : `${progress}%`}
					</span>

					{/* Chevron */}
					<svg
						className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{/* Expanded: status chips + actions + task list */}
				{isExpanded && (
					<div id={listId} className="px-4 pb-4">
						{!isEmpty && (
							<div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
								{statuses.map((status) => {
									const count = bucket.statusCounts[status] ?? 0;
									if (count === 0) return null;
									return (
										<span
											key={status}
											className={`inline-flex items-center gap-1.5 ${getInlineStatusClass(status)}`}
										>
											<span className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusDotColor(status) }} />
											{count} {status}
										</span>
									);
								})}
							</div>
						)}

						<div className="flex flex-wrap items-center gap-2">
							<Link
								to={`/?lane=milestone&milestone=${encodeURIComponent(bucket.milestone ?? "")}`}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
							>
								<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
								</svg>
								Board
							</Link>
							<Link
								to={`/tasks?milestone=${encodeURIComponent(bucket.milestone ?? "")}`}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
							>
								<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
								</svg>
								List
							</Link>
							<button
								type="button"
								onClick={() => openEditModal(bucket)}
								disabled={isArchiving || isSavingMilestone || isRemoving}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
							>
								{isSavingMilestone ? "Saving..." : "Edit"}
							</button>
							<button
								type="button"
								onClick={() => openRemoveModal(bucket)}
								disabled={isArchiving || isSavingMilestone || isRemoving}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-60"
							>
								{isRemoving ? "Removing..." : "Remove"}
							</button>
							<button
								type="button"
								onClick={() => handleArchiveMilestone(bucket)}
								disabled={isArchiving || isSavingMilestone || isRemoving}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-60"
							>
								{isArchiving ? "Archiving..." : "Archive"}
							</button>
						</div>

						{!isEmpty && (
							<div className="mt-3 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
								<div className="divide-y divide-gray-200 dark:divide-gray-700">
									{sortedTasks.slice(0, 10).map((task) => (
										<MilestoneTaskRow
											key={task.id}
											task={task}
											isDone={isDoneStatus(task.status)}
											statusBadgeClass={getStatusBadgeClass(task.status)}
											priorityBadgeClass={getPriorityBadgeClass(task.priority)}
											onEditTask={onEditTask}
											onDragStart={handleDragStart}
											onDragEnd={handleDragEnd}
										/>
									))}
								</div>
								{sortedTasks.length > 10 && (
									<div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
										<Link
											to={`/tasks?milestone=${encodeURIComponent(bucket.milestone ?? "")}`}
											className="text-blue-600 dark:text-blue-400 hover:underline"
										>
											View all {sortedTasks.length} tasks →
										</Link>
									</div>
								)}
							</div>
						)}
						{isEmpty && (
							<p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
								{isDragging ? "Drop a task here to add it to this milestone." : "No tasks yet — drag one here to assign it."}
							</p>
						)}
					</div>
				)}
			</div>
		);
	};

	// Render unassigned tasks section with table layout
	const renderUnassignedSection = () => {
		if (!unassignedBucket || (!isSearchActive && unassignedBucket.total === 0)) return null;

		const sortedActiveTasks = getSortedTasks(unassignedBucket.tasks.filter((task) => !isDoneStatus(task.status)));
		const isExpanded = expandedBuckets["__unassigned"] ?? true;
		const displayTasks = showAllUnassigned ? sortedActiveTasks : sortedActiveTasks.slice(0, 12);
		const hasMore = sortedActiveTasks.length > 12;
		const hasActiveUnassignedTasks = sortedActiveTasks.length > 0;

		return (
			<div className="mb-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 transition-colors duration-200">
				<div className="px-5 py-4">
					{/* Header */}
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-2">
							<svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
								Unassigned tasks
							</h3>
							<span className="text-sm text-gray-500 dark:text-gray-400">
								({sortedActiveTasks.length})
							</span>
						</div>
						<button
							type="button"
							onClick={() => setExpandedBuckets((c) => ({ ...c, "__unassigned": !isExpanded }))}
							className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
						>
							{isExpanded ? "Collapse" : "Expand"}
							<svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
							</svg>
						</button>
					</div>

					{isExpanded && (
						<div className="mt-4">
							{hasActiveUnassignedTasks ? (
								<>
									{/* Table */}
									<div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
										{/* Table header */}
										<div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
											<div className="w-6" /> {/* Drag handle column */}
											<div className="w-24">ID</div>
											<div>Title</div>
											<div className="text-center w-24">Status</div>
											<div className="text-center w-20">Priority</div>
										</div>

										{/* Table rows */}
										<div className="divide-y divide-gray-200 dark:divide-gray-700">
											{displayTasks.map((task) => (
												<MilestoneTaskRow
													key={task.id}
													task={task}
													isDone={isDoneStatus(task.status)}
													statusBadgeClass={getStatusBadgeClass(task.status)}
													priorityBadgeClass={getPriorityBadgeClass(task.priority)}
													onEditTask={onEditTask}
													onDragStart={handleDragStart}
													onDragEnd={handleDragEnd}
												/>
											))}
										</div>

										{/* Footer with show more/less */}
										{hasMore && (
											<div className="px-3 py-2 text-xs border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
												<button
													type="button"
													onClick={() => setShowAllUnassigned(!showAllUnassigned)}
													className="text-blue-600 dark:text-blue-400 hover:underline"
												>
													{showAllUnassigned
														? "Show less ↑"
														: `Show all ${sortedActiveTasks.length} tasks ↓`}
												</button>
											</div>
										)}
									</div>

									{/* Hint */}
									<p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
										Drag tasks to a milestone below to assign them
									</p>
								</>
							) : (
								<p className="rounded-md border border-dashed border-gray-300 dark:border-gray-600 bg-white/70 dark:bg-gray-800/50 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
									{isSearchActive
										? "No matching unassigned tasks."
										: "No active unassigned tasks. Completed tasks are hidden."}
								</p>
							)}
						</div>
					)}
				</div>
			</div>
		);
	};

	const hasSearchMatches = visibleBuckets.some((bucket) => bucket.total > 0);
	const showSearchNoMatchHint = isSearchActive && !hasSearchMatches;
	const noMilestones = !isSearchActive && activeMilestones.length === 0 && completedMilestones.length === 0;
	const canReassignRemovedMilestone = removeReassignOptions.length > 0;

	return (
		<div className="excali page-shell transition-colors duration-200">
			{/* Hand-drawn ink filter (same feTurbulence trick as Statistics) so the wobbly
			    milestone panels read as drawn-by-hand on this page too. */}
			<svg width="0" height="0" className="absolute" aria-hidden="true">
				<filter id="stat-rough" x="-6%" y="-6%" width="112%" height="112%">
					<feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves={2} seed={5} result="noise" />
					<feDisplacementMap in="SourceGraphic" in2="noise" scale={3} xChannelSelector="R" yChannelSelector="G" />
				</filter>
			</svg>
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-4 mb-6">
				<div className="flex flex-wrap items-center gap-4">
					<h1 className="excali-hand text-3xl font-bold text-gray-900 dark:text-white">Milestones</h1>
					<div className="relative w-full min-w-[240px] max-w-[420px]">
						<span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 dark:text-gray-500">
							<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
						</span>
						<label htmlFor="milestones-search" className="sr-only">
							Search milestones
						</label>
						<input
							id="milestones-search"
							type="text"
							value={searchQuery}
							onInput={(event) => setSearchQuery((event.target as HTMLInputElement).value)}
							placeholder="Search tasks"
							aria-label="Search milestones"
							className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200"
						/>
						{isSearchActive && (
							<button
								type="button"
								onClick={() => setSearchQuery("")}
								aria-label="Clear milestone search"
								className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
							>
								<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						)}
					</div>
				</div>
				<div className="flex items-center gap-3">
					{success && (
						<span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
							</svg>
							{success}
						</span>
					)}
					{error && (
						<span className="inline-flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.33 16a2 2 0 001.74 3z" />
							</svg>
							{error}
						</span>
					)}
					<button
						type="button"
						onClick={() => setShowAddModal(true)}
						className="inline-flex items-center gap-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold border-2 border-gray-800 dark:border-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400 dark:focus:ring-offset-gray-900 transition-colors"
							style={{ borderRadius: "12px 10px 13px 9px / 9px 13px 10px 12px" }}
					>
						+ Add milestone
					</button>
				</div>
			</div>

			{/* Search no-match hint */}
			{showSearchNoMatchHint && (
				<div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
					<p className="text-sm text-amber-800 dark:text-amber-200">
						No milestones or tasks match &quot;{searchQueryTrimmed}&quot;.
					</p>
					<button
						type="button"
						onClick={() => setSearchQuery("")}
						className="rounded-md border border-amber-300 dark:border-amber-700 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
					>
						Clear search
					</button>
				</div>
			)}

			{/* Unassigned tasks */}
			{renderUnassignedSection()}

			{/* Active milestones */}
			{activeMilestones.length > 0 && (
				<div className="excali-box overflow-hidden">
						{activeMilestones.map((bucket, index) => renderMilestoneRow(bucket, index + 1))}
				</div>
			)}

			{/* Completed milestones */}
			{completedMilestones.length > 0 && (
				<div className="mt-8">
					{isSearchActive ? (
						<div className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
							<span>Completed milestones</span>
							<span className="text-xs text-gray-500 dark:text-gray-500">({completedMilestones.length})</span>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setShowCompleted((value) => !value)}
							className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
						>
							<span>Completed milestones</span>
							<span className="text-xs text-gray-500 dark:text-gray-500">({completedMilestones.length})</span>
							<svg
								className={`w-4 h-4 transition-transform ${showCompleted ? "rotate-180" : ""}`}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
							</svg>
						</button>
					)}
					{(isSearchActive || showCompleted) && (
						<div className="mt-4 excali-box overflow-hidden">
								{completedMilestones.map((bucket, index) => renderMilestoneRow(bucket, index + 1))}
						</div>
					)}
				</div>
			)}

			{/* Empty state */}
			{noMilestones && !unassignedBucket?.total && (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
					</svg>
					<p className="text-gray-500 dark:text-gray-400">No milestones yet. Create one to start organizing your tasks.</p>
				</div>
			)}

			{/* Add modal */}
			<Modal isOpen={showAddModal} onClose={closeAddModal} title="Add milestone" maxWidthClass="max-w-md">
				<form onSubmit={handleAddMilestone} className="space-y-4">
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-900 dark:text-gray-100">Milestone name</label>
						<input
							type="text"
							value={newMilestone}
							onChange={(e) => handleNewMilestoneChange(e.target.value)}
							placeholder="e.g. Release 1.0"
							autoFocus
							className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						{error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
					</div>
					<div className="space-y-2">
						<label htmlFor="new-milestone-due-date" className="text-sm font-medium text-gray-900 dark:text-gray-100">
							Due
						</label>
						<input
							id="new-milestone-due-date"
							type="date"
							value={newMilestoneDueDate}
							onChange={(event) => setNewMilestoneDueDate(event.target.value)}
							className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={closeAddModal}
							className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSaving || !newMilestone.trim()}
							className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors"
						>
							{isSaving ? "Saving..." : "Create"}
						</button>
					</div>
				</form>
			</Modal>

			{/* Edit modal */}
			<Modal isOpen={editingBucket !== null} onClose={closeEditModal} title="Edit milestone" maxWidthClass="max-w-md">
				<form onSubmit={handleUpdateMilestone} className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="edit-milestone-name" className="text-sm font-medium text-gray-900 dark:text-gray-100">
							Milestone name
						</label>
						<input
							id="edit-milestone-name"
							type="text"
							value={editMilestoneName}
							onInput={(event) => handleEditMilestoneNameChange((event.target as HTMLInputElement).value)}
							autoFocus
							className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						<p className="text-xs text-gray-500 dark:text-gray-400">
							Renaming updates local tasks that reference this milestone.
						</p>
						{modalError && <p className="text-xs text-red-600 dark:text-red-400">{modalError}</p>}
					</div>
					<div className="space-y-2">
						<label htmlFor="edit-milestone-due-date" className="text-sm font-medium text-gray-900 dark:text-gray-100">
							Due
						</label>
						<input
							id="edit-milestone-due-date"
							type="date"
							value={editMilestoneDueDate}
							onChange={(event) => setEditMilestoneDueDate(event.target.value)}
							className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={closeEditModal}
							className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={savingMilestoneKey !== null || !editMilestoneName.trim()}
							className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors"
						>
							{savingMilestoneKey ? "Saving..." : "Save"}
						</button>
					</div>
				</form>
			</Modal>

			{/* Remove modal */}
			<Modal isOpen={removingBucket !== null} onClose={closeRemoveModal} title="Remove milestone" maxWidthClass="max-w-md">
				<div className="space-y-4">
					<p className="text-sm text-gray-600 dark:text-gray-300">
						Remove milestone &quot;{removingBucket?.label ?? ""}&quot; and choose what happens to its tasks.
					</p>
					<div className="space-y-3">
						<label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-3 text-sm text-gray-700 dark:text-gray-200">
							<input
								type="radio"
								name="remove-milestone-task-handling"
								value="clear"
								checked={removeTaskHandling === "clear"}
								onChange={() => {
									setRemoveTaskHandling("clear");
									setModalError(null);
								}}
								className="mt-0.5"
							/>
							<span>
								<span className="block font-medium text-gray-900 dark:text-gray-100">Leave tasks unassigned</span>
								<span className="block text-xs text-gray-500 dark:text-gray-400">
									Clear this milestone from matching local tasks.
								</span>
							</span>
						</label>
						<label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-3 text-sm text-gray-700 dark:text-gray-200">
							<input
								type="radio"
								name="remove-milestone-task-handling"
								value="reassign"
								checked={removeTaskHandling === "reassign"}
								disabled={!canReassignRemovedMilestone}
								onChange={() => {
									setRemoveTaskHandling("reassign");
									setModalError(null);
								}}
								className="mt-0.5"
							/>
							<span className="flex-1">
								<span className="block font-medium text-gray-900 dark:text-gray-100">Reassign tasks</span>
								<span className="block text-xs text-gray-500 dark:text-gray-400">
									Move matching local tasks to another milestone.
								</span>
								<select
									value={removeReassignTo}
									onChange={(event) => {
										setRemoveReassignTo(event.target.value);
										setModalError(null);
									}}
									disabled={removeTaskHandling !== "reassign" || !canReassignRemovedMilestone}
									className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
								>
									{removeReassignOptions.map((milestone) => (
										<option key={milestone.id} value={milestone.id}>
											{milestone.title}
										</option>
									))}
								</select>
							</span>
						</label>
					</div>
					{modalError && <p className="text-xs text-red-600 dark:text-red-400">{modalError}</p>}
					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={closeRemoveModal}
							className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleRemoveMilestone}
							disabled={removingMilestoneKey !== null || (removeTaskHandling === "reassign" && !removeReassignTo)}
							className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
						>
							{removingMilestoneKey ? "Removing..." : "Remove milestone"}
						</button>
					</div>
				</div>
			</Modal>
		</div>
	);
};

export default MilestonesPage;
