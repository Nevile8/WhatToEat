import React, { useState } from 'react';
import { Utensils, Clock, DollarSign, AlertCircle, Loader2 } from 'lucide-react';
import './App.css';

function App() {
  const [timeToMake, setTimeToMake] = useState('30');
  const [priceRange, setPriceRange] = useState('average');
  const [restrictions, setRestrictions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [menuData, setMenuData] = useState(null);
  const [error, setError] = useState(null);

  const timeOptions = [
    { value: '15', label: '15 Mins', icon: '⚡' },
    { value: '30', label: '30 Mins', icon: '🕐' },
    { value: '45', label: '45-60 Mins', icon: '🕐🕐' }
  ];

  const priceOptions = [
    { value: 'budget', label: 'Budget', symbol: '$' },
    { value: 'average', label: 'Average', symbol: '$$' },
    { value: 'gourmet', label: 'Gourmet', symbol: '$$$' }
  ];

  const restrictionOptions = [
    { value: 'gluten-free', label: 'Gluten-Free' },
    { value: 'dairy-free', label: 'Dairy-Free' },
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'nut-allergy', label: 'Nut-Allergy' },
    { value: 'shellfish-allergy', label: 'Shellfish-Allergy' }
  ];

  const toggleRestriction = (value) => {
    setRestrictions(prev =>
      prev.includes(value)
        ? prev.filter(r => r !== value)
        : [...prev, value]
    );
  };

  const generateMenu = async () => {
  setIsLoading(true);
  setError(null);
  setMenuData(null);

  const timeDesc = timeToMake === '15' ? '15 minutes or less' : 
                   timeToMake === '30' ? '30 minutes or less' : 
                   '45-60 minutes';
  
  const priceDesc = priceRange === 'budget' ? 'budget-friendly, inexpensive ingredients' :
                    priceRange === 'average' ? 'average-priced ingredients' :
                    'gourmet, premium ingredients';
  
  const restrictionsDesc = restrictions.length > 0 
    ? restrictions.map(r => r.replace('-', ' ')).join(', ')
    : 'no dietary restrictions';

  const prompt = `You are a professional nutritionist and meal planner. Generate a 7-day dinner menu (Monday to Sunday).

You MUST follow these constraints:
- Preparation Time: All meals must take approximately ${timeDesc} to prepare.
- Cost: All meals must use ${priceDesc}. ${priceRange === 'budget' ? 'Avoid expensive proteins and exotic ingredients.' : priceRange === 'gourmet' ? 'Include high-quality proteins and specialty ingredients.' : 'Use common grocery store ingredients.'}
- Dietary Restrictions: All meals MUST be 100% ${restrictionsDesc}.

Output Format: Respond ONLY with a valid JSON array. Each object must have exactly these three keys:
- "day": The day of the week (e.g., "Monday")
- "meal_name": The name of the meal
- "simple_description": A brief one-sentence description

Example format:
[
  {"day": "Monday", "meal_name": "Grilled Chicken Salad", "simple_description": "A fresh salad with grilled chicken breast, mixed greens, and vinaigrette."},
  {"day": "Tuesday", "meal_name": "Beef Tacos", "simple_description": "Soft corn tortillas filled with seasoned ground beef and toppings."}
]

Do not include any text before or after the JSON array. Return only valid JSON.`;

  try {
    const response = await fetch('/api/generate-menu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        timeToMake,
        priceRange,
        restrictions
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to generate menu');
    }

    if (data.success && data.menu) {
      setMenuData(data.menu);
    } else {
      throw new Error('Invalid response format');
    }

  } catch (err) {
    setError(err.message || 'Failed to generate menu. Please try again.');
    console.error('Menu generation error:', err);
  } finally {
    setIsLoading(false);
  }
  };

  return (
    <div className="app-container">
      <div className="app-content">
        {/* Header */}
        <div className="app-header">
          <div className="header-title">
            <Utensils className="header-icon" />
            <h1>What I Eat?</h1>
          </div>
          <p className="header-subtitle">AI-Powered Weekly Meal Planning in Seconds</p>
        </div>

        {/* Control Panel */}
        <div className="control-panel">
          {/* Time to Make */}
          <div className="control-section">
            <label className="control-label">
              <Clock className="label-icon" />
              Time to Make
            </label>
            <div className="button-grid">
              {timeOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setTimeToMake(option.value)}
                  className={`option-button ${timeToMake === option.value ? 'selected time-selected' : ''}`}
                >
                  <span className="button-icon">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="control-section">
            <label className="control-label">
              <DollarSign className="label-icon price-icon" />
              Price Range
            </label>
            <div className="button-grid">
              {priceOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setPriceRange(option.value)}
                  className={`option-button ${priceRange === option.value ? 'selected price-selected' : ''} price-${option.value}`}
                >
                  <span className="price-symbol">{option.symbol}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Allergies/Restrictions */}
          <div className="control-section">
            <label className="control-label">
              <AlertCircle className="label-icon restriction-icon" />
              Allergies & Restrictions
            </label>
            <div className="checkbox-grid">
              {restrictionOptions.map(option => (
                <label
                  key={option.value}
                  className={`checkbox-label ${restrictions.includes(option.value) ? 'checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={restrictions.includes(option.value)}
                    onChange={() => toggleRestriction(option.value)}
                    className="checkbox-input"
                  />
                  <span className="checkbox-text">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateMenu}
            disabled={isLoading}
            className="generate-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="button-spinner" />
                Generating Your Menu...
              </>
            ) : (
              <>
                <Utensils className="button-icon-main" />
                Generate My Weekly Menu
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-container">
            <p>{error}</p>
          </div>
        )}

        {/* Results */}
        {menuData && (
          <div className="results-container">
            <h2 className="results-title">
              <span className="results-emoji">🎉</span>
              Your Weekly Menu
            </h2>
            <div className="menu-list">
              {menuData.map((item, index) => (
                <div
                  key={index}
                  className="menu-item"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="menu-item-header">
                    <h3 className="menu-day">{item.day}</h3>
                    <span className="menu-badge">Day {index + 1}</span>
                  </div>
                  <p className="menu-name">{item.meal_name}</p>
                  <p className="menu-description">{item.simple_description}</p>
                </div>
              ))}
            </div>
            
            {/* Demo Note */}
            <div className="demo-note">
              <p>
                <strong>Demo Mode:</strong> This is a simulated response. In production, this would connect to Google Gemini, AWS Claude, or Azure GPT-4 via API to generate truly dynamic menus based on your constraints.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;