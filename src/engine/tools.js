/**
 * Tool Registry for Cactus Needle
 * Connects real JavaScript tool execution callbacks to Needle's WebAssembly engine.
 */

import { tool } from 'cactus-needle/browser';
import { calculate, convertUnits } from '../services/calculator.js';
import { translateText } from '../services/translation.js';
import { searchPlaces, findNearbyPlaces, getDirections } from '../services/maps.js';
import { getWeather } from '../services/weather.js';
import { webSearch } from '../services/research.js';

// Execution listeners for UI indicators
const toolExecutionListeners = new Set();

export function onToolExecution(callback) {
  toolExecutionListeners.add(callback);
  return () => toolExecutionListeners.delete(callback);
}

function notifyToolStart(name, input) {
  for (const listener of toolExecutionListeners) {
    try {
      listener({ type: 'start', name, input, timestamp: Date.now() });
    } catch (e) {
      console.error(e);
    }
  }
}

function notifyToolEnd(name, input, result, error) {
  for (const listener of toolExecutionListeners) {
    try {
      listener({ type: 'end', name, input, result, error, timestamp: Date.now() });
    } catch (e) {
      console.error(e);
    }
  }
}

/**
 * 8 Registered Tools for Cactus Needle
 */
export const registeredTools = {
  // 1. Calculator
  calculator: tool({
    description: "Evaluate math and arithmetic expressions with numbers and operators (e.g., 245 * 18, sqrt(144) + 12, 15% of 850).",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Mathematical expression"
        }
      },
      required: ["expression"]
    },
    execute: async ({ expression }) => {
      notifyToolStart('calculator', { expression });
      try {
        const res = await calculate(expression);
        notifyToolEnd('calculator', { expression }, res, null);
        return res;
      } catch (err) {
        notifyToolEnd('calculator', { expression }, null, err.message);
        throw err;
      }
    }
  }),

  // 2. Unit Converter
  unit_converter: tool({
    description: "Convert physical units like km to miles, kg to lbs, celsius to fahrenheit.",
    inputSchema: {
      type: "object",
      properties: {
        value: {
          type: "number",
          description: "The numerical value to convert"
        },
        fromUnit: {
          type: "string",
          description: "The source unit, e.g., 'km', 'miles', 'celsius', 'fahrenheit', 'kg', 'lbs'"
        },
        toUnit: {
          type: "string",
          description: "The target unit, e.g., 'miles', 'km', 'fahrenheit', 'celsius', 'lbs', 'kg'"
        }
      },
      required: ["value", "fromUnit", "toUnit"]
    },
    execute: async ({ value, fromUnit, toUnit }) => {
      notifyToolStart('unit_converter', { value, fromUnit, toUnit });
      try {
        const res = await convertUnits({ value, fromUnit, toUnit });
        notifyToolEnd('unit_converter', { value, fromUnit, toUnit }, res, null);
        return res;
      } catch (err) {
        notifyToolEnd('unit_converter', { value, fromUnit, toUnit }, null, err.message);
        throw err;
      }
    }
  }),

  // 3. Translation
  translate_text: tool({
    description: "Translate words, phrases, or sentences into another natural language (e.g. translate hello into Hindi, French, Spanish).",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to translate"
        },
        targetLanguage: {
          type: "string",
          description: "Target language name or code"
        },
        sourceLanguage: {
          type: "string",
          description: "Optional source language name or ISO code"
        }
      },
      required: ["text", "targetLanguage"]
    },
    execute: async ({ text, targetLanguage, sourceLanguage = 'auto' }) => {
      notifyToolStart('translate_text', { text, targetLanguage, sourceLanguage });
      try {
        const res = await translateText({ text, targetLanguage, sourceLanguage });
        notifyToolEnd('translate_text', { text, targetLanguage, sourceLanguage }, res, null);
        return res;
      } catch (err) {
        notifyToolEnd('translate_text', { text, targetLanguage, sourceLanguage }, null, err.message);
        throw err;
      }
    }
  }),

  // 4. Search Places
  search_places: tool({
    description: "Locate a specific address or city on the map (e.g. search Tokyo, locate Paris).",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Location query"
        }
      },
      required: ["query"]
    },
    execute: async ({ query }) => {
      notifyToolStart('search_places', { query });
      try {
        const res = await searchPlaces({ query });
        notifyToolEnd('search_places', { query }, res, null);
        return res;
      } catch (err) {
        notifyToolEnd('search_places', { query }, null, err.message);
        throw err;
      }
    }
  }),

  // 5. Find Nearby Places
  find_nearby_places: tool({
    description: "Find nearby places, hospitals, petrol stations, or restaurants in a location.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Category like hospital or petrol station"
        },
        location: {
          type: "string",
          description: "City or location name"
        },
        radius: {
          type: "number",
          description: "Search radius in meters"
        }
      },
      required: ["category"]
    },
    execute: async ({ category, location, radius = 5000 }) => {
      notifyToolStart('find_nearby_places', { category, location, radius });
      try {
        const res = await findNearbyPlaces({ category, location, radius });
        notifyToolEnd('find_nearby_places', { category, location, radius }, res, null);
        return res;
      } catch (err) {
        notifyToolEnd('find_nearby_places', { category, location, radius }, null, err.message);
        throw err;
      }
    }
  }),

  // 6. Get Directions
  get_directions: tool({
    description: "Get driving route and navigation directions to a destination (e.g., give directions from Paris to Lyon, route to Kyoto).",
    inputSchema: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          description: "Destination location"
        },
        origin: {
          type: "string",
          description: "Optional starting location"
        },
        mode: {
          type: "string",
          enum: ["driving", "walking", "cycling"],
          description: "Travel mode"
        }
      },
      required: ["destination"]
    },
    execute: async ({ origin = '', destination, mode = 'driving' }) => {
      notifyToolStart('get_directions', { origin, destination, mode });
      try {
        const res = await getDirections({ origin, destination, mode });
        notifyToolEnd('get_directions', { origin, destination, mode }, res, null);
        return res;
      } catch (err) {
        notifyToolEnd('get_directions', { origin, destination, mode }, null, err.message);
        throw err;
      }
    }
  }),

  // 7. Get Weather
  get_weather: tool({
    description: "Show weather forecast and temperature in a city or location.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City or region name"
        }
      },
      required: ["location"]
    },
    execute: async ({ location }) => {
      notifyToolStart('get_weather', { location });
      try {
        const res = await getWeather({ location });
        notifyToolEnd('get_weather', { location }, res, null);
        return res;
      } catch (err) {
        notifyToolEnd('get_weather', { location }, null, err.message);
        throw err;
      }
    }
  }),

  // 8. Web Search
  web_search: tool({
    description: "Search the web or internet for any topic, person, biography, news, facts, history, current events, research questions, or online information (e.g. search Netaji Subash Chandra Bose, latest news, who was Albert Einstein).",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query string"
        },
        limit: {
          type: "number",
          description: "Maximum number of search results"
        }
      },
      required: ["query"]
    },
    execute: async ({ query, limit = 5 }) => {
      notifyToolStart('web_search', { query, limit });
      try {
        const res = await webSearch({ query, limit });
        notifyToolEnd('web_search', { query, limit }, res, null);
        return res;
      } catch (err) {
        notifyToolEnd('web_search', { query, limit }, null, err.message);
        throw err;
      }
    }
  })
};
