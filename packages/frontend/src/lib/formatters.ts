import { ethers } from 'ethers';

/**
 * Formats TFuel from BigInt values (bigint or string representing BigInt).
 * Always treats input as a BigInt value that needs to be converted using formatUnits.
 */
export const formatTFuelBigInt = (amount: string | bigint, decimals: number = 18): string => {
  console.log('amount (BigInt)', amount);
  try {
    let num: number;
    
    if (typeof amount === 'bigint') {
      // If it's a BigInt, convert using formatUnits
      const formatted = ethers.formatUnits(amount, decimals);
      num = parseFloat(formatted);
    } else {
      // If it's a string, treat it as a BigInt string and convert using formatUnits
      const formatted = ethers.formatUnits(amount, decimals);
      num = parseFloat(formatted);
    }
    
    if (num === 0) return '0';
    if (num < 0.000001) return '< 0.000001';
    if (num < 0.01) return num.toFixed(6);
    if (num < 1) return num.toFixed(4);
    if (num < 100) return num.toFixed(2);
    if (num < 1000) return num.toFixed(1);
    if (num < 1000000) return num.toFixed(1);
    if (num >= 10000000) return num.toFixed(0);
    
    return num.toString();
  } catch (error) {
    console.error('Error formatting TFuel (BigInt):', error);
    return '0';
  }
};

/**
 * Formats TFuel from normal numbers (number or string representing a decimal number).
 * Does NOT treat strings as BigInt values - only handles decimal numbers.
 */
export const formatTFuel = (amount: string | number, decimals: number = 18): string => {
  console.log('amount', amount);
  try {
    let num: number;
    
    // Handle different input types
    if (typeof amount === 'number') {
      // If it's already a number, use it directly
      num = amount;
    } else {
      // If it's a string, treat it as a decimal number string
      num = parseFloat(amount);
    }
    
    if (isNaN(num)) {
      console.error('Invalid number format:', amount);
      return '0';
    }
    
    if (num === 0) return '0';
    if (num < 0.000001) return '< 0.000001';
    if (num < 0.01) return num.toFixed(6);
    if (num < 1) return num.toFixed(4);
    if (num < 100) return num.toFixed(2);
    if (num < 1000) return num.toFixed(1);
    if (num < 1000000) return num.toFixed(1);
    if (num >= 10000000) return num.toFixed(0);
    
    return num.toString();
  } catch (error) {
    console.error('Error formatting TFuel:', error);
    return '0';
  }
};

export const formatAddress = (address: string): string => {
  if (!address) return '';
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatNumber = (number: number | string): string => {
  const num = typeof number === 'string' ? parseFloat(number) : number;
  if (isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatDate = (timestamp: string | Date): string => {
  let date: Date;
  
  if (typeof timestamp === 'string') {
    // Check if it's a millisecond timestamp (13 digits)
    if (/^\d{13}$/.test(timestamp)) {
      date = new Date(parseInt(timestamp));
    } else {
      date = new Date(timestamp);
    }
  } else {
    date = timestamp;
  }
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatBlockNumber = (blockNumber: string | bigint): string => {
  const num = typeof blockNumber === 'string' ? parseInt(blockNumber) : Number(blockNumber);
  return formatNumber(num);
};

export const parseTFuel = (amount: string): bigint => {
  try {
    return ethers.parseUnits(amount, 18);
  } catch (error) {
    console.error('Error parsing TFuel:', error);
    return BigInt(0);
  }
};

export const parseTimestamp = (timestamp: string | number): number => {
  if (typeof timestamp === 'number') return timestamp;
  
  // Try to parse as ISO string
  const date = new Date(timestamp);
  if (!isNaN(date.getTime())) {
    return date.getTime();
  }
  
  // Fallback: try to parse as numeric string
  const parsed = Number(timestamp);
  if (!isNaN(parsed)) return parsed;
  
  return 0;
};

export const calculateExchangeRate = (tfuelBacking: string | bigint, stfuelSupply: string | bigint): number => {
  try {
    const backing = typeof tfuelBacking === 'string' ? BigInt(tfuelBacking) : tfuelBacking;
    const supply = typeof stfuelSupply === 'string' ? BigInt(stfuelSupply) : stfuelSupply;
    
    if (supply === BigInt(0)) return 1;
    
    const rate = Number(backing) / Number(supply);
    return rate;
  } catch (error) {
    console.error('Error calculating exchange rate:', error);
    return 1;
  }
};

export const getExplorerUrl = (txHash: string, chainId: number | null): string => {
  if (!txHash) return '';
  
  // Chain ID 365 = Theta Testnet, 361 = Theta Mainnet
  if (chainId === 365) {
    return `https://testnet-explorer.thetatoken.org/tx/${txHash}`;
  } else if (chainId === 361) {
    return `https://explorer.thetatoken.org/tx/${txHash}`;
  }
  
  // Default to testnet if chain ID is unknown
  return `https://testnet-explorer.thetatoken.org/tx/${txHash}`;
};
