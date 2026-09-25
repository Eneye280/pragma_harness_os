import { useCallback, useEffect, useMemo, useState } from "react";
import type { TreeNode } from "@shared/explorer";
import { collectDirPaths, filterTree, flattenFiles } from "./tree-utils";

export interface UseExplorerResult {
  nodes: TreeNode[];
  visibleNodes: TreeNode[];
  files: string[];
  root: string | null;
  fileCount: number;
  loading: boolean;
  error: string | null;
  expanded: Set<string>;
  toggleDir: (path: string) => void;
  search: string;
  setSearch: (value: string) => void;
  refresh: () => void;
}

export function useExplorer(): UseExplorerResult {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [root, setRoot] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const refresh = useCallback(() => {
    const bridge = window.harness?.explorer;
    if (!bridge) {
      setLoading(false);
      setError("explorer bridge unavailable");
      return;
    }
    bridge
      .getTree()
      .then((result) => {
        setNodes(result.nodes);
        setRoot(result.root);
        setFileCount(result.fileCount);
        setExpanded((current) => (current.size === 0 ? new Set(collectDirPaths(result.nodes)) : current));
        setError(null);
      })
      .catch(() => setError("no se pudo leer el workspace"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const bridge = window.harness?.explorer;
    if (!bridge) return;
    return bridge.onChanged(() => refresh());
  }, [refresh]);

  const toggleDir = useCallback((path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const visibleNodes = useMemo(() => filterTree(nodes, search), [nodes, search]);
  const files = useMemo(() => flattenFiles(nodes), [nodes]);

  return { nodes, visibleNodes, files, root, fileCount, loading, error, expanded, toggleDir, search, setSearch, refresh };
}
