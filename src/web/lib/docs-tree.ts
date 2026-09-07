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

/** Numeric order by the document id ("doc-N"), so a flat doc list reads in creation order rather than
 * alphabetically. Falls back to title when an id has no numeric part. */
const byId = (a: Document, b: Document) => {
	const na = Number(a.id.match(/(\d+)/)?.[1] ?? Number.NaN);
	const nb = Number(b.id.match(/(\d+)/)?.[1] ?? Number.NaN);
	if (Number.isNaN(na) || Number.isNaN(nb)) return byTitle(a, b);
	return na - nb;
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

	ungroupedDocs.sort(byId);
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
