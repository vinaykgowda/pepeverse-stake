// frontend/src/utils/helpers.js

// Parse JSON safely
const safeJsonParse = (jsonString, fallback = null) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return fallback;
  }
};

// Delay function
const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Group array by property
const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const groupKey = item[key];

    if (!result[groupKey]) {
      result[groupKey] = [];
    }

    result[groupKey].push(item);

    return result;
  }, {});
};

// Calculate total from array of objects
const calculateTotal = (array, key) => {
  return array.reduce((total, item) => {
    return total + (parseFloat(item[key]) || 0);
  }, 0);
};

// Filter array by object property value
const filterByProperty = (array, key, value) => {
  return array.filter(item => item[key] === value);
};

// Generate random color
const getRandomColor = () => {
  return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
};

// Convert bytes to human-readable size
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
};

// Check if array contains all elements from another array
const containsAll = (array, elements) => {
  return elements.every(element => array.includes(element));
};

// Deep clone object
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

export {
  safeJsonParse,
  delay,
  groupBy,
  calculateTotal,
  filterByProperty,
  getRandomColor,
  formatFileSize,
  containsAll,
  deepClone
};