const { ethers } = require('ethers');
const nodeManagerAbi = require('../src/contracts/nodeManager.abi.json');
const stfuelAbi = require('../src/contracts/stfuel.abi.json');

function generateEventSignatures(abi, contractName) {
  console.log(`\n=== ${contractName} Event Signatures ===`);
  
  const events = abi.filter(item => item.type === 'event');
  const signatures = {};
  
  events.forEach(event => {
    // Create the event signature string - do NOT include 'indexed' keyword in signature
    const params = event.inputs.map(input => input.type).join(',');
    const signature = `${event.name}(${params})`;
    
    // Generate the keccak256 hash
    const hash = ethers.keccak256(ethers.toUtf8Bytes(signature));
    
    signatures[hash] = event.name;
    console.log(`${event.name}: ${hash}`);
    console.log(`  Signature: ${signature}`);
  });
  
  return signatures;
}

console.log('Generating event signatures from ABIs...\n');

const nodeManagerSignatures = generateEventSignatures(nodeManagerAbi, 'NodeManager');
const stfuelSignatures = generateEventSignatures(stfuelAbi, 'sTFuel');

console.log('\n=== Combined Event Signatures Object ===');
console.log(JSON.stringify({...nodeManagerSignatures, ...stfuelSignatures}, null, 2));
