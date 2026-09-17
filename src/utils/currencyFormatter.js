/**
 * Formats a numeric amount to Indian Rupees (INR) format.
 * E.g., 125000 -> ₹1,25,000.00
 *
 * @param {number|string} amount
 * @returns {string} Formatted INR currency string
 */
export const formatCurrency = (amount) => {
  const num = Number(amount);
  if (isNaN(num)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};
