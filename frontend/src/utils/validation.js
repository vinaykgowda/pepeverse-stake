// frontend/src/utils/validation.js

import { PublicKey } from '@solana/web3.js';

// Validate Solana wallet address
const isValidWalletAddress = (address) => {
  try {
    if (!address) return false;

    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};

// Validate amount (positive number)
const isValidAmount = (amount) => {
  if (amount === undefined || amount === null) return false;

  const parsedAmount = parseFloat(amount);

  if (isNaN(parsedAmount)) return false;

  return parsedAmount >= 0;
};

// Validate hashlist (array of wallet addresses)
const isValidHashlist = (hashlist) => {
  if (!hashlist || !Array.isArray(hashlist) || hashlist.length === 0) return false;

  // Check if all items are valid wallet addresses
  return hashlist.every(isValidWalletAddress);
};

// Validate collection name
const isValidCollectionName = (name) => {
  return !!name && name.trim().length > 0 && name.trim().length <= 100;
};

// Validate multiplier (positive number)
const isValidMultiplier = (multiplier) => {
  if (multiplier === undefined || multiplier === null) return false;

  const parsedMultiplier = parseFloat(multiplier);

  if (isNaN(parsedMultiplier)) return false;

  return parsedMultiplier >= 0;
};

// Validate trait type and value
const isValidTraitValue = (value) => {
  return !!value && value.trim().length > 0 && value.trim().length <= 100;
};

export {
  isValidWalletAddress,
  isValidAmount,
  isValidHashlist,
  isValidCollectionName,
  isValidMultiplier,
  isValidTraitValue
};