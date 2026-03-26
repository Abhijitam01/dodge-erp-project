/**
 * Shared TypeScript shapes for the server.
 *
 * - Raw* interfaces: CSV / SAP-style field names used during ingest.
 * - Graph*: nodes and edges for the visualization (`graph.json`).
 * - Chat* / *Response: JSON bodies for the HTTP API (see index.ts routes).
 */

export interface RawInvoice {
    billingDocument: string;
    billingDocumentType?: string;
    creationDate: string;
    lastChangeDateTime?: string;
    billingDocumentDate?: string;
    billingDocumentIsCancelled?: boolean;
    cancelledBillingDocument?: string;
    totalNetAmount?: string;
    transactionCurrency?: string;
    companyCode?: string;
    fiscalYear?: string;
    accountingDocument?: string;
    soldToParty?: string;
    [key: string]: unknown;
  }
  
  export interface RawPayment {
    accountingDocument: string;
    companyCode?: string;
    fiscalYear?: string;
    glAccount?: string;
    referenceDocument?: string;
    costCenter?: string;
    profitCenter?: string;
    transactionCurrency?: string;
    amountInTransactionCurrency?: number | string;
    postingDate?: string;
    documentDate?: string;
    accountingDocumentType?: string;
    [key: string]: unknown;
  }
  
  export interface RawCustomer {
    customer: string;
    salesOrganization?: string;
    distributionChannel?: string;
    division?: string;
    customerName?: string;
    [key: string]: unknown;
  }
  
  export interface RawDelivery {
    deliveryDocument: string;
    creationDate?: string;
    shippingPoint?: string;
    overallGoodsMovementStatus?: string;
    overallPickingStatus?: string;
    actualGoodsMovementDate?: string | null;
    headerBillingBlockReason?: string;
    deliveryBlockReason?: string;
    [key: string]: unknown;
  }

  export interface RawSalesOrder {
    salesOrder: string;
    salesOrderType?: string;
    salesOrganization?: string;
    distributionChannel?: string;
    soldToParty?: string;
    creationDate?: string;
    totalNetAmount?: string;
    overallDeliveryStatus?: string;
    transactionCurrency?: string;
    headerBillingBlockReason?: string;
    deliveryBlockReason?: string;
    [key: string]: unknown;
  }

  export interface RawSalesOrderItem {
    salesOrder: string;
    salesOrderItem: string;
    material?: string;
    requestedQuantity?: string;
    requestedQuantityUnit?: string;
    netAmount?: string;
    transactionCurrency?: string;
    materialGroup?: string;
    productionPlant?: string;
    [key: string]: unknown;
  }

  export interface RawProduct {
    product: string;
    productType?: string;
    productOldId?: string;
    productGroup?: string;
    baseUnit?: string;
    division?: string;
    grossWeight?: string;
    weightUnit?: string;
    isMarkedForDeletion?: boolean;
    [key: string]: unknown;
  }

  export interface RawBillingDocumentItem {
    billingDocument: string;
    billingDocumentItem: string;
    material?: string;
    billingQuantity?: string;
    netAmount?: string;
    transactionCurrency?: string;
    referenceSdDocument?: string;
    referenceSdDocumentItem?: string;
    [key: string]: unknown;
  }

  export type NodeType = 'invoice' | 'payment' | 'customer' | 'delivery' | 'sales_order' | 'product';
  
  export interface GraphNode {
    id: string;
    type: NodeType;
    label: string;
    metadata: Record<string, unknown>;
  }
  
  export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: 'PAID_BY' | 'BELONGS_TO' | 'BILLED_BY' | 'ORDERED_BY' | 'HAS_PRODUCT';
    metadata?: Record<string, unknown>;
  }
  
  export interface Graph {
    nodes: GraphNode[];
    edges: GraphEdge[];
  }
  
  
  export interface ChatRequest {
    message: string;
  }
  
  export interface ChatResponse {
    answer: string;
    sql?: string;
    results?: Record<string, unknown>[];
    resultCount?: number;
    guarded?: boolean;
    error?: string;
    synthesisError?: string;
  }
  
  export interface NodeResponse {
    id: string;
    type: string;
    data: Record<string, unknown>;
  }
  
  export interface HealthResponse {
    status: string;
    timestamp: string;
    graphReady: boolean;
    groqKeySet: boolean;
    nodeCount?: number;
    edgeCount?: number;
  }