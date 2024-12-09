export interface Block {
  id: string;
  timestamp: number;
  previousHash: string;
  hash: string;
  data: string;
  protocolRules: ProtocolRules;
  branchId: string;
}

export interface ProtocolRules {
  name: string;
  blockSize: number;
  consensusMechanism: string;
  validationRules: string[];
}

export interface Branch {
  id: string;
  name: string;
  blocks: Block[];
  protocolRules: ProtocolRules;
}

export interface BlockPosition {
  x: number;
  y: number;
  branchIndex: number;
  blockIndex: number;
}