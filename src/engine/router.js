/**
 * Request Router and Output Processor
 * Coordinates user queries, Needle tool execution, and structured result extraction.
 * Features deterministic fallback routing modeled after Needle Research Engine v3.0 (ss.py).
 */

import { runWithNeedle } from './needle.js';
import { registeredTools, onToolExecution } from './tools.js';

export async function processUserQuery(userMessage, options = {}) {
  const query = userMessage.trim();
  if (!query) return null;

  // Track all tools executed during this run
  const executedTools = [];
  const unsubscribe = onToolExecution((event) => {
    if (event.type === 'end') {
      executedTools.push({
        name: event.name,
        arguments: event.input,
        result: event.result,
        error: event.error
      });
    }
  });

  try {
    // 1. Run local model tool-calling engine
    let runResult = null;
    try {
      runResult = await runWithNeedle(query, {
        abortSignal: options.abortSignal
      });
    } catch (err) {
      console.warn('[Shrishti AI] Model tool run skipped or timed out, applying direct router:', err);
    }

    const reasoning = runResult?.reasoning || '';
    const confidence = runResult?.confidence;

    // Check if tools were executed by the model
    if (executedTools.length > 0) {
      return {
        matched: true,
        toolCalls: executedTools,
        reasoning,
        confidence,
        raw: runResult
      };
    }

    // Check if function_calls were returned
    if (runResult?.function_calls && runResult.function_calls.length > 0) {
      return {
        matched: true,
        toolCalls: runResult.function_calls.map((tc, idx) => ({
          name: tc.name,
          arguments: tc.arguments,
          result: runResult.results?.[idx] ?? null
        })),
        reasoning,
        confidence,
        raw: runResult
      };
    }

    // 2. Deterministic Fallback Routing (Modeled strictly on ss.py handle_query)
    const lower = query.toLowerCase();

    // 2a. Weather keywords
    const weatherKeywords = lower.match(/\b(weather|temperature|forecast|rainfall|humidity|wind speed|thunderstorm)\b/i);
    if (weatherKeywords) {
      const locMatch = query.match(/(?:weather|temperature|forecast|rainfall|humidity)\s+(?:in|at|for|near|of)\s+([^?.!,]+)/i);
      const location = locMatch ? locMatch[1].trim() : query.replace(/\b(weather|temperature|forecast|check|show)\b/gi, '').trim();
      if (location) {
        try {
          const res = await registeredTools.get_weather.execute({ location });
          return {
            matched: true,
            toolCalls: [{ name: 'get_weather', arguments: { location }, result: res }],
            reasoning: `Extracted weather for ${location}`,
            confidence: 1.0,
            raw: runResult
          };
        } catch (e) {
          console.warn('Weather fallback failed:', e);
        }
      }
    }

    // 2b. Calculator expressions
    if (lower.startsWith('calculate ') || lower.startsWith('calc ') || /^[\d\s+\-*/().%^×÷,]+$/.test(query)) {
      const expr = query.replace(/^(?:calculate|calc)\s+/i, '').trim();
      try {
        const res = await registeredTools.calculator.execute({ expression: expr });
        return {
          matched: true,
          toolCalls: [{ name: 'calculator', arguments: { expression: expr }, result: res }],
          reasoning: 'Calculated mathematical expression',
          confidence: 1.0,
          raw: runResult
        };
      } catch (e) {
        console.warn('Calculator fallback failed:', e);
      }
    }

    // 2c. Unit Conversion
    if (lower.startsWith('convert ') || lower.startsWith('conversion ') || /^\d+(\.\d+)?\s*[a-zA-Z]+\s+(?:to|in)\s+[a-zA-Z]+$/i.test(query)) {
      const convMatch = query.match(/(-?\d+(?:\.\d+)?)\s*([a-zA-Z0-9]+)\s+(?:to|in)\s+([a-zA-Z0-9]+)/i);
      if (convMatch) {
        const value = parseFloat(convMatch[1]);
        const fromUnit = convMatch[2];
        const toUnit = convMatch[3];
        try {
          const res = await registeredTools.unit_converter.execute({ value, fromUnit, toUnit });
          return {
            matched: true,
            toolCalls: [{ name: 'unit_converter', arguments: { value, fromUnit, toUnit }, result: res }],
            reasoning: `Converted ${value} ${fromUnit} to ${toUnit}`,
            confidence: 1.0,
            raw: runResult
          };
        } catch (e) {
          console.warn('Converter fallback failed:', e);
        }
      }
    }

    // 2d. Translation
    if (lower.startsWith('translate ')) {
      const transMatch = query.match(/^translate\s+(.+?)\s+(?:into|to|in)\s+([a-zA-Z]+)$/i);
      if (transMatch) {
        const text = transMatch[1].trim();
        const targetLanguage = transMatch[2].trim();
        try {
          const res = await registeredTools.translate_text.execute({ text, targetLanguage });
          return {
            matched: true,
            toolCalls: [{ name: 'translate_text', arguments: { text, targetLanguage }, result: res }],
            reasoning: `Translated text to ${targetLanguage}`,
            confidence: 1.0,
            raw: runResult
          };
        } catch (e) {
          console.warn('Translation fallback failed:', e);
        }
      }
    }

    // 2e. Navigation & Directions
    if (lower.includes('directions') || lower.startsWith('route to ') || lower.startsWith('route from ')) {
      const dirMatch = query.match(/(?:directions|route)\s+(?:from\s+(.+?)\s+)?to\s+([^?.!,]+)/i);
      if (dirMatch) {
        const origin = dirMatch[1] ? dirMatch[1].trim() : '';
        const destination = dirMatch[2] ? dirMatch[2].trim() : '';
        try {
          const res = await registeredTools.get_directions.execute({ origin, destination, mode: 'driving' });
          return {
            matched: true,
            toolCalls: [{ name: 'get_directions', arguments: { origin, destination }, result: res }],
            reasoning: `Found directions to ${destination}`,
            confidence: 1.0,
            raw: runResult
          };
        } catch (e) {
          console.warn('Directions fallback failed:', e);
        }
      }
    }

    // 2f. Web Research & Search Intent (Handles 'search in web', 'serach in web', 'research', 'who is', 'what is', or any general research query)
    const searchPrefixMatch = query.match(/^(?:search(?:\s+(?:the\s+web\s+(?:for\s+)?|in\s+web\s+|online\s+(?:for\s+)?|web\s+(?:for\s+)?|for\s+))?|serach(?:\s+(?:the\s+web\s+(?:for\s+)?|in\s+web\s+|online\s+(?:for\s+)?|web\s+(?:for\s+)?|for\s+))?|research\s+|look\s+up\s+|find\s+out\s+(?:about\s+)?)\s*(.+)$/i);

    let searchQuery = '';
    if (searchPrefixMatch && searchPrefixMatch[1]) {
      searchQuery = searchPrefixMatch[1].trim();
    } else if (
      lower.startsWith('who is ') ||
      lower.startsWith('who was ') ||
      lower.startsWith('what is ') ||
      lower.startsWith('tell me about ') ||
      lower.startsWith('explain ') ||
      lower.includes(' vs ') ||
      lower.startsWith('verify ') ||
      query.length >= 3 // General query fallback directly matching ss.py: "Ask a research question directly"
    ) {
      searchQuery = query;
    }

    if (searchQuery) {
      try {
        const searchRes = await registeredTools.web_search.execute({ query: searchQuery, limit: 5 });
        return {
          matched: true,
          toolCalls: [{
            name: 'web_search',
            arguments: { query: searchQuery, limit: 5 },
            result: searchRes
          }],
          reasoning: `Executed Orange-B Web Research for "${searchQuery}"`,
          confidence: 1.0,
          raw: runResult
        };
      } catch (searchErr) {
        console.error('Research fallback execution error:', searchErr);
      }
    }

    // If tools still were not matched
    return {
      matched: false,
      toolCalls: [],
      reasoning,
      message: "I didn't find a matching tool for your request. Shrishti AI is a specialized tool-calling assistant powered by Orange-B with 8 real-world capabilities:\n\n" +
        "• **Calculator**: Calculate expressions (e.g., `Calculate 245 * 18`, `sqrt(144) + 12`, `15% of 850`)\n" +
        "• **Unit Converter**: Convert units (e.g., `Convert 100 km to miles`, `50 kg in lbs`)\n" +
        "• **Translation**: Translate text (e.g., `Translate hello into Hindi`, `Translate Good morning into French`)\n" +
        "• **Search Places**: Look up cities or landmarks (e.g., `Search places in Tokyo`, `Where is the Eiffel Tower`)\n" +
        "• **Nearby Places**: Find services (e.g., `Find cafes in Paris`, `Find nearby petrol stations`)\n" +
        "• **Directions**: Navigation & routes (e.g., `Give directions from Paris to Lyon`, `Route from Tokyo to Kyoto`)\n" +
        "• **Weather**: Current & 7-day forecast (e.g., `Show the weather in Tokyo`, `Weather in London`)\n" +
        "• **Web Search**: Research & current events (e.g., `Search the web for recent AI developments`)",
      raw: runResult
    };
  } finally {
    unsubscribe();
  }
}
