import React, { useState, useEffect, useMemo } from "react";
import * as tf from "@tensorflow/tfjs";
// IMPORTANT: Import the CSS file
import './App.css';

const generateProductData = (count = 200) => {
  const products = [];
  let uniqueNames = new Set();
  
  let nameIndex = 0;
  let modIndex = 0;
  let varIndex = 0;
  
  for (let i = 1; i <= count; i++) {
    // Generate the unique SKU/ID (using zero padding for visual clarity)
    const productSku = `SKU-${i.toString().padStart(4, '0')}`;
    
    // --- Data generation logic ---
    const inventory = Math.floor(Math.random() * 200) + 10;
    const avgSales = Math.floor(Math.random() * 50) + 5;
    const leadTime = Math.floor(Math.random() * 6) + 1;

    const safetyStockThreshold = 2 * avgSales * leadTime;
    const reorderLabel = inventory < safetyStockThreshold ? 1 : 0;

    products.push({
      id: i, 
      sku: productSku,
      inventoryLevel: inventory,
      averageSalesPerWeek: avgSales,
      daysToReplenish: leadTime,
      reorderLabel: reorderLabel,
      suggestion: "Pending",
      // Add class for styling, but initial state is pending
      suggestionClass: "", 
      predictionValue: 'N/A' // Initialize prediction value
    });
  }
  return products;
};

// --- Helper Functions ---

const getSortIcon = (key, sortConfig) => {
    if (!sortConfig || sortConfig.key !== key) {
        return '';
    }
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
};

// --- React Component ---
export default function InventoryPredictor() {
  const [products, setProducts] = useState([]);
  const [isTraining, setIsTraining] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [model, setModel] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'sku', direction: 'ascending' });

  // Data Loading 
  useEffect(() => {
    setTimeout(() => {
      const data = generateProductData(200);
      setProducts(data);
    }, 500);
  }, []);
  
  // Sorting Logic
  const sortedProducts = useMemo(() => {
    let sortableItems = [...products]; 
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = sortConfig.key === 'predictionValue' ? parseFloat(a[sortConfig.key] || 0) : a[sortConfig.key];
        const bValue = sortConfig.key === 'predictionValue' ? parseFloat(b[sortConfig.key] || 0) : b[sortConfig.key];

        if (typeof aValue === 'string') {
            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
        } else {
            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
        }
        return 0;
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


  // Model Training 
  const trainModel = async (trainingData) => {
    setIsTraining(true);
    const features = trainingData.map(p => [ p.inventoryLevel, p.averageSalesPerWeek, p.daysToReplenish ]);
    const labels = trainingData.map(p => p.reorderLabel);
    const trainingTensor = tf.tensor2d(features);
    const outputTensor = tf.tensor2d(labels, [labels.length, 1]);
    const newModel = tf.sequential();
    newModel.add(tf.layers.dense({ inputShape: [3], units: 10, activation: "relu" }));
    newModel.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    newModel.compile({ optimizer: "adam", loss: "binaryCrossentropy", metrics: ["accuracy"], });

    await newModel.fit(trainingTensor, outputTensor, { epochs: 100, shuffle: true, callbacks: { onEpochEnd: (epoch, logs) => { console.log(`Epoch ${epoch + 1}: Loss = ${logs.loss.toFixed(4)}, Accuracy = ${logs.acc.toFixed(4)}`); } } });

    trainingTensor.dispose();
    outputTensor.dispose();
    setModel(newModel);
    setIsTraining(false);
    setIsReady(true);
    console.log("Model Training Complete!");
    setTimeout(() => { handlePredictAll(newModel, trainingData); }, 100);
  };
  
  // Model Prediction
  const handlePredictAll = async (trainedModel = model, currentProducts = products) => {
    if (!trainedModel) { alert("Please train the model first!"); return; }
    
    console.log("Starting Prediction...");
    
    const predictionFeatures = currentProducts.map(p => [ p.inventoryLevel, p.averageSalesPerWeek, p.daysToReplenish ]);
    const predictionTensor = tf.tensor2d(predictionFeatures);
    
    const predictions = trainedModel.predict(predictionTensor);
    const predictionData = await predictions.data();
    
    const updatedProducts = currentProducts.map((product, index) => {
        const value = predictionData[index];
        const suggestion = value > 0.5 ? "🔴 Reorder NOW" : "🟢 Stock OK";
        const suggestionClass = value > 0.5 ? 'reorder-now' : 'stock-ok';
        
        return {
            ...product,
            suggestion: suggestion,
            suggestionClass: suggestionClass,
            predictionValue: value.toFixed(4)
        };
    });
    
    predictionTensor.dispose();
    predictions.dispose();
    setProducts(updatedProducts);
    console.log("Prediction Complete!");
  };

  return (
    <div className="inventory-container">
      
      {/* Header and Title */}
      <h1 className="header-text">📈 Inventory Prediction Dashboard</h1>
      <p className="sub-header-text">
        Total Products Loaded: <strong>{products.length}</strong> | Click on a column header to sort the table.
      </p>

      {/* Control Panel (Card Style) */}
      <div className="control-panel">
        <h3>Model Controls</h3>
        
        <div className="control-buttons-group">
            <button 
              onClick={() => products.length > 0 && trainModel(products)} 
              disabled={isTraining || isReady || products.length === 0}
              className={isReady ? 'btn-train btn-trained' : 'btn-train'}
            >
              {isTraining ? '🏋️ Training Model... (Check Console)' : isReady ? '✅ Model Trained!' : '1. Train Predictive Model'}
            </button>
            
            {isTraining && <span style={{ color: 'var(--color-primary)' }}>Training in progress...</span>}
        </div>
      </div>
      
      {/* Dashboard Table */}
      <div className="dashboard-table-wrapper">
        <table className="inventory-table">
          <thead>
            <tr>
              {/* Product ID / SKU Column */}
              <th onClick={() => handleSort('sku')} style={{borderTopLeftRadius: '8px'}}>
                Product ID / SKU {getSortIcon('sku', sortConfig)}
              </th>
              {/* Inventory Level Column */}
              <th onClick={() => handleSort('inventoryLevel')}>
                Current Inventory Level {getSortIcon('inventoryLevel', sortConfig)}
              </th>
              {/* Avg. Sales Column */}
              <th onClick={() => handleSort('averageSalesPerWeek')}>
                Avg. Weekly Sales {getSortIcon('averageSalesPerWeek', sortConfig)}
              </th>
              {/* Lead Time Column */}
              <th onClick={() => handleSort('daysToReplenish')}>
                Lead Time (Days) {getSortIcon('daysToReplenish', sortConfig)}
              </th>
              {/* Suggestion Column */}
              <th onClick={() => handleSort('suggestion')}>
                Reorder Suggestion {getSortIcon('suggestion', sortConfig)}
              </th>
              {/* Confidence Column */}
              <th onClick={() => handleSort('predictionValue')} style={{borderTopRightRadius: '8px'}}>
                Confidence (0-1) {getSortIcon('predictionValue', sortConfig)}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((product) => (
              <tr key={product.id}>
                <td className="sku-cell">{product.sku}</td>
                <td>{product.inventoryLevel}</td>
                <td>{product.averageSalesPerWeek}</td>
                <td>{product.daysToReplenish}</td>
                <td className={`suggestion-cell ${product.suggestionClass}`}>
                    {product.suggestion}
                </td>
                <td style={{color: 'var(--color-dark-gray)'}}>{product.predictionValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
    </div>
  );
}