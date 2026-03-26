export const NODE_COLORS = {
  customer:    '#2563eb',
  invoice:     '#f97316',
  payment:     '#16a34a',
  delivery:    '#7c3aed',
  sales_order: '#d97706',
  product:     '#ec4899',
};

export const NODE_LABELS = {
  customer:    'Customer',
  invoice:     'Invoice',
  payment:     'Payment',
  delivery:    'Delivery',
  sales_order: 'Sales Order',
  product:     'Product',
};

const CLUSTERS = {
  customer:    { cx: 400,  cy: 1000 },
  sales_order: { cx: 1000, cy: 500  },
  delivery:    { cx: 1600, cy: 1000 },
  invoice:     { cx: 2200, cy: 500  },
  payment:     { cx: 2800, cy: 1000 },
  product:     { cx: 2200, cy: 1500 },
};

const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);

export function layoutNodes(apiNodes) {
  const typeCount = {};

  return apiNodes.map((node) => {
    const type = node.type ?? 'invoice';
    const idx  = typeCount[type] ?? 0;
    typeCount[type] = idx + 1;

    const cluster = CLUSTERS[type] ?? { cx: 1600, cy: 1000 };
    const radius  = 50 + idx * 8;
    const angle   = idx * GOLDEN_ANGLE;

    return {
      id:       node.id,
      type:     'dot',
      position: {
        x: cluster.cx + Math.cos(angle) * radius,
        y: cluster.cy + Math.sin(angle) * radius,
      },
      data: {
        label:    node.label ?? node.id,
        nodeType: type,
        color:    NODE_COLORS[type] ?? '#94a3b8',
        metadata: node.metadata ?? {},
      },
      selectable: true,
    };
  });
}

export function transformEdges(apiEdges) {
  return apiEdges.map((edge) => ({
    id:     edge.id,
    source: edge.source,
    target: edge.target,
    type:   'straight',
    style:  { stroke: '#93c5fd', strokeWidth: 1.5, opacity: 0.7 },
  }));
}

export function buildDegreeMap(apiEdges) {
  const map = {};
  for (const edge of apiEdges) {
    map[edge.source] = (map[edge.source] ?? 0) + 1;
    map[edge.target] = (map[edge.target] ?? 0) + 1;
  }
  return map;
}
