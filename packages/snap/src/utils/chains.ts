export const SUPPORTED_CHAINS : { [key: string]: {url: string } }= {
  // Ethereum Mainnet
  'eip155:1': {url: 'https://etherscan.io/address/' },
  // Sepolia Testnet
  'eip155:11155111': {url: 'https://sepolia.etherscan.io/address/' },
  // BSC Mainnet
  'eip155:38': { url: 'https://bscscan.com/address/' },
  // BSC Testnet
  'eip155:61': { url: 'https://testnet.bscscan.com/address/' },
};