import { Block, ProtocolRules, Branch } from '../types/blockchain';
import { createHash, generateUUID } from './crypto';

export const createBlock = async (
  previousBlock: Block | null,
  data: string,
  protocolRules: ProtocolRules,
  branchId: string
): Promise<Block> => {
  const timestamp = Date.now();
  const previousHash = previousBlock ? previousBlock.hash : '0';
  const blockData = `${timestamp}${previousHash}${data}`;
  const hash = await createHash(blockData);

  return {
    id: generateUUID(),
    timestamp,
    previousHash,
    hash,
    data,
    protocolRules,
    branchId,
  };
};

export const createBranch = (
  name: string,
  protocolRules: ProtocolRules,
  parentBlock?: Block
): Branch => {
  const branchId = generateUUID();
  const blocks: Block[] = [];

  if (parentBlock) {
    blocks.push(parentBlock);
  }

  return {
    id: branchId,
    name,
    blocks,
    protocolRules,
  };
};

export const getBlockNumber = (block: Block, branches: Branch[]): number => {
  const branch = branches.find(b => b.blocks.some(blk => blk.hash === block.hash));
  if (!branch) return 0;

  // For the main branch, count from genesis
  if (branch === branches[0]) {
    return branch.blocks.findIndex(b => b.hash === block.hash);
  }

  // For other branches, count from when they forked
  const blockIndex = branch.blocks.findIndex(b => b.hash === block.hash);
  return blockIndex; // This will be 0 for the fork point, then 1, 2, 3...
};