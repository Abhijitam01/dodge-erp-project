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

  export type NodeType = 'invoice' | 'payment' | 'customer' | 'delivery';
  
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
    type: 'PAID_BY' | 'BELONGS_TO' | 'BILLED_BY';
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