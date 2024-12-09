import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Branch, Block, BlockPosition } from '../types/blockchain';
import { getBlockNumber } from '../utils/blockchain';

interface BlockchainVisualizerProps {
  branches: Branch[];
  onBlockSelect?: (block: Block, branchIndex: number) => void;
  selectedBlockHash?: string | null;
  onAddBlock?: (branchIndex: number) => void;
  onCreateBranch?: () => void;
  selectedBranchIndex?: number;
}

export const BlockchainVisualizer: React.FC<BlockchainVisualizerProps> = ({ 
  branches, 
  onBlockSelect,
  selectedBlockHash,
  onAddBlock,
  onCreateBranch,
  selectedBranchIndex
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<SVGGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedBlockPosition, setSelectedBlockPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Calculate dimensions based on content
    const blockWidth = 100;
    const blockHeight = 50;
    const blockSpacing = 140;
    const branchSpacing = 120;

    // Calculate required width and height
    const maxBlocksInAnyBranch = Math.max(...branches.map(b => b.blocks.length));
    const width = Math.max(1000, (maxBlocksInAnyBranch * blockSpacing) + 200);
    const height = Math.max(500, (branches.length * branchSpacing) + 100);

    // Create a container for the visualization
    const container = svg.append('g')
      .attr('transform', 'translate(40, 40)');
    
    containerRef.current = container.node();

    // Set up zoom behavior
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        if (containerRef.current) {
          d3.select(containerRef.current).attr('transform', event.transform);
          setZoom(event.transform.k);
        }
      });

    svg
      .attr('width', '100%')
      .attr('height', '500')
      .attr('viewBox', [0, 0, width, height])
      .call(zoomBehavior as any)
      .call(
        zoomBehavior.transform as any,
        d3.zoomIdentity
          .translate(40, 40)
          .scale(1)
      );

    // Create layers for different elements
    const connectionsLayer = container.append('g').attr('class', 'connections-layer');
    const blocksLayer = container.append('g').attr('class', 'blocks-layer');
    const actionsLayer = container.append('g').attr('class', 'actions-layer');

    // Calculate block positions and connections
    const blockPositions = new Map<string, BlockPosition>();
    const connections: Array<{ source: string; target: string }> = [];
    const branchYPositions = new Map<string, number>();

    // First pass: position main branch blocks (straight line)
    const mainBranch = branches[0];
    branchYPositions.set(mainBranch.id, 0);
    mainBranch.blocks.forEach((block, index) => {
      blockPositions.set(block.hash, {
        x: index * blockSpacing,
        y: 0,
        branchIndex: 0,
        blockIndex: index
      });

      if (index > 0) {
        connections.push({
          source: block.previousHash,
          target: block.hash
        });
      }
    });

    // Helper function to find fork points
    const findForkPoints = (x: number): number[] => {
      return Array.from(blockPositions.values())
        .filter(pos => pos.x >= x)
        .map(pos => pos.y);
    };

    // Second pass: position forked branches with collision avoidance
    branches.slice(1).forEach((branch, branchIndex) => {
      const parentBlock = branch.blocks[0];
      const parentPos = blockPositions.get(parentBlock.hash);
      
      if (parentPos) {
        const forkStartX = parentPos.x;
        const forkStartY = parentPos.y;
        
        // Find available vertical position
        const existingYPositions = findForkPoints(forkStartX);
        let newBranchY = forkStartY;
        let spacing = branchSpacing;
        
        while (existingYPositions.some(y => Math.abs(y - newBranchY - spacing) < branchSpacing * 0.8)) {
          spacing += branchSpacing;
        }
        
        newBranchY += spacing;
        branchYPositions.set(branch.id, newBranchY);

        // Position blocks in the forked branch
        branch.blocks.forEach((block, blockIndex) => {
          if (blockIndex === 0) return; // Skip parent block

          const x = forkStartX + (blockIndex * blockSpacing);
          const y = newBranchY;
          
          blockPositions.set(block.hash, { 
            x, 
            y, 
            branchIndex: branchIndex + 1,
            blockIndex
          });
          
          if (blockIndex === 1) {
            connections.push({
              source: parentBlock.hash,
              target: block.hash
            });
          } else {
            connections.push({
              source: branch.blocks[blockIndex - 1].hash,
              target: block.hash
            });
          }
        });
      }
    });

    // Draw connections in the connections layer
    connections.forEach(({ source, target }) => {
      const sourcePos = blockPositions.get(source);
      const targetPos = blockPositions.get(target);

      if (sourcePos && targetPos) {
        const isFork = Math.abs(sourcePos.y - targetPos.y) > 1;
        
        if (isFork) {
          const path = d3.path();
          path.moveTo(sourcePos.x + blockWidth, sourcePos.y + blockHeight / 2);
          path.bezierCurveTo(
            sourcePos.x + blockWidth + blockSpacing / 2, sourcePos.y + blockHeight / 2,
            targetPos.x - blockSpacing / 2, targetPos.y + blockHeight / 2,
            targetPos.x, targetPos.y + blockHeight / 2
          );
          
          connectionsLayer.append('path')
            .attr('d', path.toString())
            .attr('stroke', '#9CA3AF')
            .attr('stroke-width', 2)
            .attr('fill', 'none');
        } else {
          connectionsLayer.append('path')
            .attr('d', `
              M ${sourcePos.x + blockWidth} ${sourcePos.y + blockHeight / 2}
              L ${targetPos.x} ${targetPos.y + blockHeight / 2}
            `)
            .attr('stroke', '#9CA3AF')
            .attr('stroke-width', 2)
            .attr('fill', 'none');
        }
      }
    });

    // Draw blocks in the blocks layer
    branches.forEach((branch, branchIndex) => {
      branch.blocks.forEach((block) => {
        const pos = blockPositions.get(block.hash);
        if (!pos) return;

        const blockGroup = blocksLayer.append('g')
          .attr('transform', `translate(${pos.x}, ${pos.y})`);

        // Block rectangle with click handler
        const rect = blockGroup.append('rect')
          .attr('width', blockWidth)
          .attr('height', blockHeight)
          .attr('rx', 6)
          .attr('class', `cursor-pointer transition-colors duration-200 ${
            selectedBlockHash === block.hash 
              ? 'fill-blue-100 stroke-blue-500 stroke-2' 
              : 'fill-white stroke-gray-300 stroke-2 hover:fill-gray-50'
          }`);

        if (onBlockSelect) {
          rect.on('click', () => {
            onBlockSelect(block, branchIndex);
            if (selectedBlockHash === block.hash) {
              setSelectedBlockPosition(null);
            } else {
              setSelectedBlockPosition({ x: pos.x, y: pos.y });
            }
          });
        }

        // Block number
        const blockNumber = getBlockNumber(block, branches);
        blockGroup.append('text')
          .attr('x', blockWidth / 2)
          .attr('y', blockHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('class', 'fill-gray-700 text-sm')
          .text(`Block ${blockNumber}`);

        // Protocol indicator
        blockGroup.append('text')
          .attr('x', blockWidth / 2)
          .attr('y', -8)
          .attr('text-anchor', 'middle')
          .attr('class', 'fill-gray-500 text-xs')
          .text(block.protocolRules.name);
      });
    });

    // Draw branch labels
    branches.forEach((branch) => {
      if (branch.blocks.length > 0) {
        const firstBlock = branch.blocks[0];
        const pos = blockPositions.get(firstBlock.hash);
        const branchY = branchYPositions.get(branch.id);
        
        if (pos && typeof branchY !== 'undefined') {
          blocksLayer.append('text')
            .attr('x', pos.x)
            .attr('y', branchY - 20)
            .text(branch.name)
            .attr('class', 'fill-gray-700 text-sm font-semibold');
        }
      }
    });

    // Add action buttons in the actions layer if block is selected
    if (selectedBlockHash && selectedBlockPosition) {
      const block = branches.flatMap(b => b.blocks).find(b => b.hash === selectedBlockHash);
      const pos = blockPositions.get(selectedBlockHash);
      
      if (block && pos) {
        // Create a white background for the action buttons
        actionsLayer.append('rect')
          .attr('x', pos.x + blockWidth + 5)
          .attr('y', pos.y - 5)
          .attr('width', 90)
          .attr('height', 64)
          .attr('rx', 6)
          .attr('fill', 'white')
          .attr('stroke', '#E5E7EB');

        // Add Block button
        const addBlockButton = actionsLayer.append('g')
          .attr('transform', `translate(${pos.x + blockWidth + 10}, ${pos.y})`)
          .attr('class', 'cursor-pointer')
          .on('click', () => onAddBlock?.(selectedBranchIndex!));

        addBlockButton.append('rect')
          .attr('width', 80)
          .attr('height', 24)
          .attr('rx', 4)
          .attr('class', 'fill-blue-500 hover:fill-blue-600');

        addBlockButton.append('text')
          .attr('x', 40)
          .attr('y', 12)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('class', 'fill-white text-xs')
          .text('Add Block');

        // Create Branch button
        const createBranchButton = actionsLayer.append('g')
          .attr('transform', `translate(${pos.x + blockWidth + 10}, ${pos.y + 30})`)
          .attr('class', 'cursor-pointer')
          .on('click', () => onCreateBranch?.());

        createBranchButton.append('rect')
          .attr('width', 80)
          .attr('height', 24)
          .attr('rx', 4)
          .attr('class', 'fill-green-500 hover:fill-green-600');

        createBranchButton.append('text')
          .attr('x', 40)
          .attr('y', 12)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('class', 'fill-white text-xs')
          .text('New Branch');
      }
    }

  }, [branches, selectedBlockHash, onBlockSelect, onAddBlock, onCreateBranch, selectedBranchIndex]);

  const handleReset = () => {
    if (svgRef.current && containerRef.current) {
      const zoomBehavior = d3.zoom();
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(
          zoomBehavior.transform as any,
          d3.zoomIdentity
            .translate(40, 40)
            .scale(1)
        );
    }
  };

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 flex space-x-2 z-10">
        <button
          onClick={handleReset}
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded text-sm"
        >
          Reset View
        </button>
        <div className="bg-white rounded shadow px-2 py-1 text-sm text-gray-600">
          Zoom: {Math.round(zoom * 100)}%
        </div>
      </div>
      <div className="w-full h-[500px] overflow-hidden">
        <svg 
          ref={svgRef} 
          className="w-full h-full cursor-move"
        />
      </div>
      <div className="text-sm text-gray-500 mt-2">
        Tip: Click a block to select it and show available actions
      </div>
    </div>
  );
};