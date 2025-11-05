// api/generate-menu.js
// Serverless function for Vercel/Netlify deployment

import { GoogleGenerativeAI } from '@google/generative-ai';

// Rate limiting helper (simple in-memory store)
const rateLimitStore = new Map();
const RATE_LIMIT = 10; // requests per IP
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitStore.get(ip) || [];
  
  // Clean old requests
  const recentRequests = userRequests.filter(time => now - time < RATE_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitStore.set(ip, recentRequests);
  return true;
}

// Main handler function
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    });
  }

  // Rate limiting
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ 
      error: 'Too many requests',
      message: 'Please wait a minute before generating another menu'
    });
  }

  // Validate request body
  const { prompt, timeToMake, priceRange, restrictions } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ 
      error: 'Bad request',
      message: 'Prompt is required'
    });
  }

  // Initialize Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('GEMINI_API_KEY not found in environment variables');
    return res.status(500).json({ 
      error: 'Configuration error',
      message: 'API key not configured. Please contact support.'
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash-latest', // Use 'gemini-pro' for the Generative Language API
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    console.log('Generating menu with Gemini...', { timeToMake, priceRange, restrictions });

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('Raw Gemini response:', text.substring(0, 200) + '...');

    // Extract JSON from response
    // Gemini sometimes wraps JSON in markdown code blocks
    let cleanedText = text.trim();
    
    // Remove markdown code blocks if present
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    // Find JSON array in the text
    const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.error('No JSON array found in response:', cleanedText);
      return res.status(500).json({ 
        error: 'Invalid AI response',
        message: 'The AI did not return a valid menu format. Please try again.'
      });
    }

    // Parse JSON
    let menuData;
    try {
      menuData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonMatch[0]);
      return res.status(500).json({ 
        error: 'Parse error',
        message: 'Could not parse AI response. Please try again.'
      });
    }

    // Validate menu structure
    if (!Array.isArray(menuData) || menuData.length !== 7) {
      console.error('Invalid menu structure:', menuData);
      return res.status(500).json({ 
        error: 'Invalid menu structure',
        message: 'The AI returned an incomplete menu. Please try again.'
      });
    }

    // Validate each menu item
    const requiredKeys = ['day', 'meal_name', 'simple_description'];
    for (const item of menuData) {
      for (const key of requiredKeys) {
        if (!item[key]) {
          console.error('Missing required key:', key, 'in item:', item);
          return res.status(500).json({ 
            error: 'Invalid menu item',
            message: 'One or more menu items are incomplete. Please try again.'
          });
        }
      }
    }

    // Success!
    console.log('Menu generated successfully');
    return res.status(200).json({ 
      success: true,
      menu: menuData,
      metadata: {
        timeToMake,
        priceRange,
        restrictions,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Gemini API error:', error);

    // Handle specific Gemini errors
    if (error.message?.includes('API_KEY_INVALID')) {
      return res.status(500).json({ 
        error: 'Configuration error',
        message: 'Invalid API key. Please contact support.'
      });
    }

    if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
      return res.status(429).json({ 
        error: 'Service busy',
        message: 'The AI service is currently busy. Please try again in a moment.'
      });
    }

    if (error.message?.includes('SAFETY')) {
      return res.status(400).json({ 
        error: 'Content filtered',
        message: 'The request was filtered by safety systems. Please adjust your selections.'
      });
    }

    // Generic error
    return res.status(500).json({ 
      error: 'Generation failed',
      message: 'Failed to generate menu. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Export for different serverless platforms
export const config = {
  runtime: 'nodejs', // or 'edge' for edge runtime
};