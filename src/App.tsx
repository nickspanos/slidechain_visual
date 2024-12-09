import React, { useState, useCallback } from 'react';
import { BlockchainVisualizer } from './components/BlockchainVisualizer';
import { Branch, ProtocolRules, Block } from './types/blockchain';
import { createBlock, createBranch } from './utils/blockchain';

const initialProtocolRules: ProtocolRules = {
  name: 'Standard Protocol',
  blockSize: 1,
  consensusMechanism: 'PoW',
  validationRules: ['Standard validation'],
};

const alternativeProtocolRules: ProtocolRules = {
  name: 'Enhanced Protocol',
  blockSize: 2,
  consensusMechanism: 'PoS',
  validationRules: ['Enhanced validation', 'Additional security'],
};

function App() {
  const [branches, setBranches] = useState<Branch[]>(() => {
    const mainBranch = createBranch('Main Branch', initialProtocolRules);
    return [mainBranch];
  });

  const [selectedBlock, setSelectedBlock] = useState<{
    block: Block;
    branchIndex: number;
  } | null>(null);

  // Initialize the genesis block
  React.useEffect(() => {
    const initializeGenesisBlock = async () => {
      const mainBranch = branches[0];
      const firstBlock = await createBlock(null, 'Genesis Block', initialProtocolRules, mainBranch.id);
      setBranches(prev => {
        const newBranches = [...prev];
        newBranches[0].blocks = [firstBlock];
        return newBranches;
      });
    };

    if (branches[0].blocks.length === 0) {
      initializeGenesisBlock();
    }
  }, []);

  const handleBlockSelect = useCallback((block: Block, branchIndex: number) => {
    setSelectedBlock(prev => 
      prev?.block.hash === block.hash ? null : { block, branchIndex }
    );
  }, []);

  const addBlock = useCallback(async (branchIndex: number) => {
    if (!selectedBlock) return;

    // Find the branch that contains the selected block
    const targetBranch = branches.find(branch => 
      branch.blocks.some(block => block.hash === selectedBlock.block.hash)
    );

    if (!targetBranch) return;

    const targetBranchIndex = branches.indexOf(targetBranch);
    const blockIndex = targetBranch.blocks.findIndex(block => block.hash === selectedBlock.block.hash);
    
    // Create new block in the correct branch
    const newBlock = await createBlock(
      selectedBlock.block,
      `Block ${blockIndex + 2}`,
      targetBranch.protocolRules,
      targetBranch.id
    );

    setBranches(prevBranches => {
      const newBranches = [...prevBranches];
      const branch = newBranches[targetBranchIndex];
      
      // Remove any blocks that came after the selected block
      branch.blocks = branch.blocks.slice(0, blockIndex + 1);
      
      // Add the new block
      branch.blocks.push(newBlock);
      
      return newBranches;
    });
    
    setSelectedBlock(null);
  }, [branches, selectedBlock]);

  const createNewBranchWithBlock = useCallback(async () => {
    if (!selectedBlock) return;

    const { block, branchIndex } = selectedBlock;
    const parentBranch = branches[branchIndex];
    
    const blockIndex = parentBranch.blocks.findIndex(b => b.hash === block.hash);
    const newBranchName = `Branch from Block ${blockIndex}`;
    
    const newBranch = createBranch(
      newBranchName,
      alternativeProtocolRules,
      block
    );

    // Create the first block for the new branch
    const firstBlock = await createBlock(
      block,
      `Block 1`,
      alternativeProtocolRules,
      newBranch.id
    );

    newBranch.blocks.push(firstBlock);

    setBranches(prev => [...prev, newBranch]);
    setSelectedBlock(null);
  }, [branches, selectedBlock]);

  const clearBlockchain = useCallback(async () => {
    const mainBranch = createBranch('Main Branch', initialProtocolRules);
    const genesisBlock = await createBlock(null, 'Genesis Block', initialProtocolRules, mainBranch.id);
    mainBranch.blocks = [genesisBlock];
    setBranches([mainBranch]);
    setSelectedBlock(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Multibranch Blockchain Demonstration</h1>
          <button
            onClick={clearBlockchain}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
          >
            Clear Blockchain
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Blockchain Visualization</h2>
          <BlockchainVisualizer 
            branches={branches} 
            onBlockSelect={handleBlockSelect}
            selectedBlockHash={selectedBlock?.block.hash}
            onAddBlock={addBlock}
            onCreateBranch={createNewBranchWithBlock}
            selectedBranchIndex={selectedBlock?.branchIndex}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {branches.map((branch, index) => (
            <div key={branch.id} className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-2">{branch.name}</h3>
              <p className="text-sm text-gray-600 mb-4">
                Protocol: {branch.protocolRules.name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;