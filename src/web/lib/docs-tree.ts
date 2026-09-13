import type { Document } from "../../types";

/**
 * Represents a folder node in the docs tree structure.
 * Each node contains docs directly in this folder and nested subfolders.
 */
export interface DocsTreeNode {
	/** Folder name (e.g., "guides") */
	name: string;
	/** Full folder path (e.g., "guides/auth") */
	path: string;
	/** Docs directly in this folder */
	docs: Document[];
	/** Nested subfolders */
	children: DocsTreeNode[];
}

/**
 * Result of building the docs tree structure.
 * Contains the hierarchical tree and any docs without folder paths.
 */
export interface DocsTreeResult {
	/** Top-level folder nodes */
	tree: DocsTreeNode[];
	/** Docs without folder path */
	ungroupedDocs: Document[];
}

const byTitle = (a: Document, b: Document) => a.title.localeCompare(b.title);

// Order artifacts by the build-workflow stage that produces them (Discovery → … → lessons), so the
// Artifacts list reads as the project's lifecycle. Matched against a doc's filename, else its title;
// anything unmatched sorts after, by title.
const DOC_STAGE_ORDER: RegExp[] = [
	/discovery/i, // Stage 1 — Product Discovery
	/research.?notes/i, // discovery input
	/solution/i, // Stage 2 — Solution Design
	/evaluation.?plan/i, // Stage 3 — Evaluation Design
	/\bdesign\b/i, // Stage 4 — UI/UX Design
	/milestone/i, // Stage 5 — Problem Breakdown
	/ticket/i, // Stage 5 — Problem Breakdown
	/technical.?plan|implementation.?plan/i, // Stage 6 — Technical Planning
	/test.?cases/i, // Stage 6 — test plan
	/qa.?report/i, // Stage 9/10 — consolidated QA gate
	/eval.?report/i, // Stage 9/10 — evaluation report
	/lesson.?learn|lessons.?learn/i, // Stage 11 — lessons learnt
	/handoff/i, // running baton
	/deck|pitch/i, // pitch decks
];

const stageRank = (doc: Document): number => {
	const key = (doc.path?.split("/").pop() ?? doc.title ?? "").toLowerCase();
	const index = DOC_STAGE_ORDER.findIndex((pattern) => pattern.test(key));
	return index === -1 ? DOC_STAGE_ORDER.length : index;
};

/** Build-workflow stage order, then title within a stage. */
const byStage = (a: Document, b: Document) => {
	const delta = stageRank(a) - stageRank(b);
	return delta !== 0 ? delta : byTitle(a, b);
};

/**
 * Builds a hierarchical tree structure from a flat list of documents.
 *
 * - Documents with a folder in their `path` are organized into nested folders
 * - Documents without a folder path are returned as ungrouped
 * - Folders and documents are sorted alphabetically
 *
 * @param docs - Array of documents to organize
 * @returns Tree structure and ungrouped documents
 */
export function buildDocsTree(docs: Document[]): DocsTreeResult {
	const tree: DocsTreeNode[] = [];
	const foldersByPath = new Map<string, DocsTreeNode>();
	const ungroupedDocs: Document[] = [];

	const getFolder = (folderPath: string): DocsTreeNode => {
		const existing = foldersByPath.get(folderPath);
		if (existing) {
			return existing;
		}
		const separatorIndex = folderPath.lastIndexOf("/");
		const node: DocsTreeNode = {
			name: folderPath.slice(separatorIndex + 1),
			path: folderPath,
			docs: [],
			children: [],
		};
		foldersByPath.set(folderPath, node);
		if (separatorIndex === -1) {
			tree.push(node);
		} else {
			getFolder(folderPath.slice(0, separatorIndex)).children.push(node);
		}
		return node;
	};

	for (const doc of docs) {
		// Everything before the last path segment (the filename) is the folder path.
		const folderPath = doc.path?.split("/").slice(0, -1).join("/") ?? "";
		if (folderPath === "") {
			ungroupedDocs.push(doc);
		} else {
			getFolder(folderPath).docs.push(doc);
		}
	}

	ungroupedDocs.sort(byStage);
	sortTree(tree);
	return { tree, ungroupedDocs };
}

/**
 * Recursively sorts folders and docs alphabetically.
 */
function sortTree(nodes: DocsTreeNode[]): void {
	nodes.sort((a, b) => a.name.localeCompare(b.name));
	for (const node of nodes) {
		node.docs.sort(byTitle);
		sortTree(node.children);
	}
}
