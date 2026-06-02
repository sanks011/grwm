import path from 'path'
import { readJSON } from '../utils/fse.js'

export interface GraphifyRef {
  available: boolean
  graphPath: string
  nodeCount: number
  edgeCount: number
  topNodes: string[]
  generatedAt: string
}

/**
 * Layer 2: Read Graphify graph.json if present.
 * NEVER dumps graph content — only returns a pointer + metadata.
 * The new agent queries the graph directly via its MCP plugin.
 */
export async function getGraphifyRef(
  projectRoot: string,
  graphifyPath: string = 'graphify-out/graph.json'
): Promise<GraphifyRef> {
  const graphPath = path.join(projectRoot, graphifyPath)

  try {
    const graph = await readJSON(graphPath)

    // Find top nodes by edge connectivity (most central = most important)
    const nodeCounts = new Map<string, number>()
    for (const edge of graph.edges ?? []) {
      nodeCounts.set(edge.source, (nodeCounts.get(edge.source) ?? 0) + 1)
      nodeCounts.set(edge.target, (nodeCounts.get(edge.target) ?? 0) + 1)
    }

    const topNodes = [...nodeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => {
        const node = (graph.nodes ?? []).find((n: { id: string; label?: string }) => n.id === id)
        return node?.label ?? id
      })

    return {
      available: true,
      graphPath,
      nodeCount: (graph.nodes ?? []).length,
      edgeCount: (graph.edges ?? []).length,
      topNodes,
      generatedAt: graph.metadata?.generatedAt ?? 'unknown',
    }
  } catch {
    return {
      available: false,
      graphPath,
      nodeCount: 0,
      edgeCount: 0,
      topNodes: [],
      generatedAt: '',
    }
  }
}
