/**
 * PaintCorp Corp AI - Doubts & Knowledge System Verification Suite
 * Tests conversational doubt resolution, how/why queries, and knowledge base search.
 */

const { processMessage } = require("./services/corpAI/aiService");
const { findBestSection, searchKnowledge } = require("./services/corpAI/knowledgeService");

async function runTests() {
  console.log("=====================================================================");
  console.log(" PaintCorp Corp AI - Doubts & Knowledge Base Verification Suite");
  console.log("=====================================================================\n");

  const testCases = [
    {
      name: "Low Stock Alert Threshold Explanation",
      query: "How does the low stock alert threshold work?",
      expectedKeyword: "15",
      expectedSource: "knowledge"
    },
    {
      name: "Stock Deduction Explanation",
      query: "Why did my stock decrease after creating an order?",
      expectedKeyword: "stock deduction",
      expectedSource: "knowledge"
    },
    {
      name: "Order Cancellation & Stock Restoration",
      query: "What happens when an order is cancelled?",
      expectedKeyword: "restored",
      expectedSource: "knowledge"
    },
    {
      name: "Negative Stock Prevention",
      query: "How does billing prevent negative stock?",
      expectedKeyword: "negative",
      expectedSource: "knowledge"
    },
    {
      name: "Order Immutability / Modification Doubt",
      query: "Can I modify an order once submitted?",
      expectedKeyword: "cannot be modified",
      expectedSource: "knowledge"
    },
    {
      name: "Invoice Search Clarification",
      query: "Why can't I find an order by invoice number?",
      expectedKeyword: "Order ID",
      expectedSource: "knowledge"
    },
    {
      name: "Revenue Calculation Explanation",
      query: "How are revenue calculations done in Sales Analysis?",
      expectedKeyword: "revenue",
      expectedSource: "knowledge"
    },
    {
      name: "Database Architecture Doubt",
      query: "What database does PaintCorp use?",
      expectedKeyword: "MySQL",
      expectedSource: "knowledge"
    },
    {
      name: "Add Paint Product Workflow",
      query: "How do I add a new paint product?",
      expectedKeyword: "Paint Catalog",
      expectedSource: "knowledge"
    },
    {
      name: "System Overview",
      query: "What is PaintCorp?",
      expectedKeyword: "PaintCorp",
      expectedSource: "system"
    }
  ];

  let passed = 0;
  for (let i = 0; i < testCases.length; i++) {
    const t = testCases[i];
    console.log(`[TEST ${i + 1}: ${t.name}]`);
    console.log(`  Query: "${t.query}"`);
    const res = await processMessage({ message: t.query });
    
    const sourceOk = res.source === t.expectedSource;
    const keywordOk = res.answer && res.answer.toLowerCase().includes(t.expectedKeyword.toLowerCase());
    
    if (sourceOk && keywordOk) {
      console.log(`  ✓ [PASS] Source: ${res.source}`);
      console.log(`  ✓ [PASS] Contains keyword: "${t.expectedKeyword}"`);
      console.log(`  Snippet: "${res.answer.split("\n")[0]}..."\n`);
      passed++;
    } else {
      console.log(`  ✗ [FAIL] Source expected: ${t.expectedSource}, got: ${res.source}`);
      console.log(`  ✗ [FAIL] Keyword "${t.expectedKeyword}" in answer: ${keywordOk}`);
      console.log(`  Answer was: ${res.answer}\n`);
    }
  }

  console.log("=====================================================================");
  console.log(` Result: ${passed}/${testCases.length} tests passed successfully.`);
  console.log("=====================================================================");

  if (passed !== testCases.length) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
