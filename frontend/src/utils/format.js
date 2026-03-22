// frontend/src/utils/format.js

// Format SOL amount
const formatSol = (amount, decimals = 4) => {
  if (amount === undefined || amount === null) return '0';

  const parsedAmount = parseFloat(amount);

  if (isNaN(parsedAmount)) return '0';

  return parsedAmount.toFixed(decimals);
};

// Format token amount
const formatToken = (amount, decimals = 4) => {
  if (amount === undefined || amount === null) return '0';

  const parsedAmount = parseFloat(amount);

  if (isNaN(parsedAmount)) return '0';

  return parsedAmount.toFixed(decimals);
};

// Format wallet address
const formatWalletAddress = (address, startLength = 4, endLength = 4) => {
  if (!address) return '';

  if (address.length <= startLength + endLength) return address;

  return `${address.substring(0, startLength)}...${address.substring(address.length - endLength)}`;
};

// Format date
const formatDate = (date) => {
  if (!date) return '';

  const d = new Date(date);

  if (isNaN(d.getTime())) return '';

  return d.toLocaleDateString();
};

// Format date with time
const formatDateTime = (date) => {
  if (!date) return '';

  const d = new Date(date);

  if (isNaN(d.getTime())) return '';

  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
};

// Format duration in days
const formatDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return '';

  const start = new Date(startDate);
  const end = new Date(endDate || new Date());

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';

  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
};

export {
  formatSol,
  formatToken,
  formatWalletAddress,
  formatDate,
  formatDateTime,
  formatDuration
};