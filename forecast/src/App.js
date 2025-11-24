import React, { useState, useEffect, useMemo, useCallback } from "react";

// Load Tailwind for styling
// Note: We are using Tailwind CSS classes directly for styling.

// --- Environment Setup (Mandatory) ---
const apiKey = ""; 
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// --- Helper Functions ---

/**
 * Generates mock product data. In a real app, this logic would be on the API server.
 * This is used to simulate the API response payload.
 */
const generateProductData = (count = 200) => {
  const products = [];
  
  for (let i = 1; i <= count; i++) {
    const productSku = `SKU-${i.toString().padStart(4, '0')}`;
    
    // --- Input features for prediction ---
    const inventory = Math.floor(Math.random() * 200) + 10;
    const avgSales = Math.floor(Math.random() * 50) + 5;
    const leadTime = Math.floor(Math.random() * 6) + 1;

    // The 'Ground Truth' for the API model to learn/predict against
    // Safety Stock Rule: Reorder if Inventory is less than 2x Sales * Lead Time
    const safetyStockThreshold = 2 * avgSales * leadTime;
    const reorderLabel = inventory < safetyStockThreshold ? 1 : 0; 

    products.push({
      id: i, 
      sku: productSku,
      inventoryLevel: inventory,
      averageSalesPerWeek: avgSales,
      daysToReplenish: leadTime,
      reorderLabel: reorderLabel, // This is the "correct" classification based on the simple rule
      suggestion: "Pending",
      suggestionClass: "text-gray-500", 
      predictionValue: 'N/A' // Initialize prediction value
    });
  }
  return products;
};

const getSortIcon = (key, sortConfig) => {
  if (!sortConfig || sortConfig.key !== key) {
    return null;
  }
  return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
};

// --- Main Component ---
export default function InventoryPredictor() {
  const [products, setProducts] = useState([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true); // New state for initial data fetch
  const [sortConfig, setSortConfig] = useState({ key: 'predictionValue', direction: 'descending' });

  // Data Loading - Simulating Fetch from an Existing API
  useEffect(() => {
    const fetchProductDataFromAPI = async () => {
      console.log("Fetching product data from simulated API...");
      setIsLoadingData(true);
      
      // Simulate network delay for a real API call (e.g., 1.5 seconds)
      await new Promise(resolve => setTimeout(resolve, 1500)); 

      try {
        // In a real application, you would use:
        // const response = await fetch('YOUR_EXTERNAL_PRODUCT_API_URL');
        // const apiData = await response.json();
        // setProducts(apiData);
        
        // Using the mock data generator to simulate the API payload
        const data = generateProductData(200);
        setProducts(data);

      } catch (error) {
        console.error("Failed to fetch product data:", error);
        // Display user-friendly error message here if the API call fails
      } finally {
        setIsLoadingData(false);
        console.log("Product data fetch complete.");
      }
    };

    fetchProductDataFromAPI();
  }, []);
  
  // Sorting Logic
  const sortedProducts = useMemo(() => {
    let sortableItems = [...products]; 
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = sortConfig.key === 'predictionValue' ? parseFloat(a[sortConfig.key] || 0) : a[sortConfig.key];
        const bValue = sortConfig.key === 'predictionValue' ? parseFloat(b[sortConfig.key] || 0) : b[sortConfig.key];

        const comparison = typeof aValue === 'string'
          ? aValue.localeCompare(bValue)
          : (aValue < bValue ? -1 : aValue > bValue ? 1 : 0);

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }
    return sortableItems;
  }, [products, sortConfig]);

  // Handle click on table header
  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  /**
   * @fileOverview The function responsible for calling the Gemini API to get predictions for all products.
   * This logic remains unchanged and is performed after the initial product data is loaded.
   */
  const handlePredictAll = useCallback(async () => {
    if (products.length === 0) {
        // Using console.error instead of alert as per instructions
        console.error("Cannot run prediction: No product data loaded.");
        return;
    }
    
    setIsPredicting(true);
    let updatedProducts = [...products];

    // System instruction: Act as a classifier and return a structured JSON object.
    const systemPrompt = "You are an inventory classification AI. Analyze the provided product inventory data against a safety stock rule (Inventory < 2 * Sales * Lead Time) to classify it. Output ONLY a JSON array of objects. The 'confidence' should be a floating-point number between 0 and 1, representing the likelihood of needing a reorder (1.0 means highly likely, 0.0 means unlikely).";

    // User prompt: Concatenate all product data into a single string for the model to process.
    const productDataString = products.map(p => 
      `SKU: ${p.sku}, Inventory: ${p.inventoryLevel}, Sales: ${p.averageSalesPerWeek}, Lead Time: ${p.daysToReplenish}, GroundTruth(0=OK, 1=Reorder): ${p.reorderLabel}`
    ).join(' | ');

    const userQuery = `Analyze the following product data and generate the prediction JSON for all items based on the safety stock rule. Data: ${productDataString}`;

    // Define the required JSON structure (Schema)
    const responseSchema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: {
                sku: { type: "STRING", description: "The SKU of the product being analyzed." },
                confidence: { type: "NUMBER", description: "The reorder probability (0.0 to 1.0)." },
                suggestion: { type: "STRING", description: "The suggested action ('🟢 Stock OK' or '🔴 Reorder NOW')." }
            },
            required: ["sku", "confidence", "suggestion"],
            propertyOrdering: ["
