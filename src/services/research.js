/**
 * Orange-B Web Research Engine v3.0 (Formerly Needle Research Engine)
 * Client service connecting to /api/search.py on Vercel with high-fidelity browser fallback.
 * Strictly reproduces the Needle Research Engine v3.0 logic and output format.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were',
  'what', 'why', 'how', 'who', 'when', 'where',
  'which', 'does', 'do', 'did', 'can', 'could',
  'would', 'should', 'about', 'for', 'to', 'of',
  'in', 'on', 'at', 'and', 'or', 'with', 'from',
  'by', 'it', 'this', 'that', 'these', 'those',
  'please', 'give', 'show', 'explain', 'tell',
  'me', 'find', 'search'
]);

function extractTerms(text) {
  const words = String(text).toLowerCase().match(/[a-zA-Z0-9][a-zA-Z0-9'-]*/g) || [];
  const set = new Set();
  for (const w of words) {
    if (w.length > 2 && !STOP_WORDS.has(w)) {
      set.add(w);
    }
  }
  return set;
}

function splitSentences(text) {
  // Regex equivalent to Python (?<=[.!?])\s+(?=[A-Z0-9])
  const sentences = String(text || '').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  return sentences.map(s => s.trim()).filter(s => s.length > 30);
}

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function getSourceQuality(url) {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    if (domain.endsWith('.gov') || domain.includes('.gov.')) return 'Government source';
    if (domain.endsWith('.edu') || domain.includes('.edu.')) return 'Educational source';
    if (domain.endsWith('.ac.in')) return 'Academic source';
    if (domain.endsWith('.gov.in')) return 'Indian government source';
    if (domain.includes('wikipedia.org')) return 'Encyclopedia';
    return 'Web source';
  } catch {
    return 'Web source';
  }
}

function getSourceScope(url, query = '', snippet = '') {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    const combined = `${domain} ${query} ${snippet.slice(0, 200)}`.toLowerCase();

    // Local indicators: specific locality, city, district or region
    if (/\b(?:city|district|municipality|local|neighborhood|borough|county|ward|tokyo|london|paris|new york|mumbai|delhi)\b/.test(combined)) {
      return 'Local';
    }

    // International indicators: global organizations, worldwide scope
    if (/(?:un\.org|who\.int|unesco\.org|worldbank\.org|imf\.org|wto\.org|nature\.com|arxiv\.org)/.test(domain)) {
      return 'International';
    }

    // National indicators: country-specific TLDs
    if (/\.(?:in|gov\.in|ac\.in|uk|gov\.uk|ac\.uk|us|ca|au|de|fr|jp)$/.test(domain)) {
      return 'National';
    }

    return domain.includes('wikipedia.org') ? 'International' : 'National';
  } catch {
    return 'National';
  }
}

function rankEvidence(query, sources) {
  const queryTerms = extractTerms(query);
  const ranked = [];

  for (const source of sources) {
    const content = source.content || source.snippet || '';
    const sentences = splitSentences(content);

    for (const sentence of sentences) {
      const sentenceTerms = extractTerms(sentence);
      if (sentenceTerms.size === 0) continue;

      let overlap = 0;
      for (const t of sentenceTerms) {
        if (queryTerms.has(t)) overlap++;
      }

      const coverage = overlap / Math.max(1, queryTerms.size);
      const density = overlap / Math.max(1, sentenceTerms.size);
      const score = coverage * 0.7 + density * 0.3;

      if (score > 0) {
        ranked.push({ score, sentence, source });
      }
    }
  }

  ranked.sort((a, b) => b.score - a.score);

  const selected = [];
  const seenTermSets = [];

  for (const item of ranked) {
    const current = extractTerms(item.sentence);
    let duplicate = false;

    for (const prev of seenTermSets) {
      let inter = 0;
      for (const t of current) {
        if (prev.has(t)) inter++;
      }
      const unionSize = new Set([...current, ...prev]).size;
      const similarity = inter / Math.max(1, unionSize);

      if (similarity > 0.72) {
        duplicate = true;
        break;
      }
    }

    if (!duplicate) {
      selected.push(item);
      seenTermSets.push(current);
      if (selected.length >= 6) break;
    }
  }

  return selected;
}

function formatResearchReport(query, sources, evidence) {
  if (!sources || sources.length === 0) {
    return 'No usable search results were found. Try changing the search query.';
  }

  const lines = [];
  lines.push('RESEARCH OVERVIEW');
  lines.push('='.repeat(55));

  if (evidence && evidence.length > 0) {
    const overview = evidence.slice(0, 3).map(e => e.sentence).join(' ');
    lines.push(overview);
  } else {
    lines.push('Relevant sources were found, but no sufficiently relevant evidence sentences could be extracted.');
  }

  lines.push('');
  lines.push('KEY FINDINGS');
  lines.push('='.repeat(55));

  if (evidence && evidence.length > 0) {
    evidence.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.sentence}`);
    });
  }

  lines.push('');
  lines.push('SOURCES');
  lines.push('='.repeat(55));

  const seen = new Set();
  let number = 1;

  for (const source of sources) {
    if (seen.has(source.url)) continue;
    seen.add(source.url);

    lines.push(`[${number}] ${source.title}`);
    lines.push(`    ${source.url}`);
    lines.push(`    Type: ${source.quality || getSourceQuality(source.url)}`);
    number++;
  }

  lines.push('');
  lines.push('Note: The overview is generated from retrieved evidence. It is not an independent factual verification or an LLM-generated synthesis.');

  return lines.join('\n');
}

/**
 * Main Web Search & Research Function
 */
export async function webSearch({ query, limit = 5 }) {
  if (!query || query.trim() === '') {
    throw new Error('Search query is required.');
  }

  const cleanQuery = query.trim();
  const maxResults = Math.min(10, Math.max(1, limit));

  // 1. Primary: Serverless Python /api/search (Vercel deployment)
  try {
    const apiRes = await fetch(`/api/search?q=${encodeURIComponent(cleanQuery)}&limit=${maxResults}`, {
      signal: AbortSignal.timeout(12000)
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && (data.rawText || (data.sources && data.sources.length > 0))) {
        return {
          query: cleanQuery,
          rawText: data.rawText,
          overview: data.overview,
          findings: data.findings || [],
          sources: data.sources || data.results || [],
          results: data.results || data.sources || [],
          provider: data.provider || 'Orange-B Research Engine v3.0'
        };
      }
    }
  } catch (apiErr) {
    console.info('Serverless /api/search not available or timed out, activating high-fidelity browser research engine.');
  }

  // 2. High-Fidelity Browser-Direct Research Fallback (executing exact Needle v3.0 pipeline)
  const rawSources = [];

  // 2a. Wikipedia Knowledge Base
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&origin=*&utf8=1&srlimit=${maxResults}`;
    const wikiRes = await fetch(wikiUrl);
    if (wikiRes.ok) {
      const wikiData = await wikiRes.json();
      const items = wikiData.query?.search || [];
      for (const item of items) {
        const cleanSnippet = item.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`;
        rawSources.push({
          title: cleanText(item.title),
          url,
          snippet: cleanText(cleanSnippet),
          content: cleanText(cleanSnippet),
          quality: getSourceQuality(url),
          scope: getSourceScope(url, cleanQuery, cleanSnippet)
        });
      }
    }
  } catch (wikiErr) {
    console.warn('Wikipedia fallback search error:', wikiErr);
  }

  // 2b. DuckDuckGo Instant Answer / Topics
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
    const ddgRes = await fetch(ddgUrl);
    if (ddgRes.ok) {
      const ddgData = await ddgRes.json();
      if (ddgData.AbstractText && ddgData.AbstractURL) {
        rawSources.push({
          title: cleanText(ddgData.Heading || cleanQuery),
          url: ddgData.AbstractURL,
          snippet: cleanText(ddgData.AbstractText),
          content: cleanText(ddgData.AbstractText),
          quality: getSourceQuality(ddgData.AbstractURL),
          scope: getSourceScope(ddgData.AbstractURL, cleanQuery, ddgData.AbstractText)
        });
      }
      if (Array.isArray(ddgData.RelatedTopics)) {
        for (const topic of ddgData.RelatedTopics) {
          if (rawSources.length >= maxResults) break;
          if (topic.Text && topic.FirstURL) {
            rawSources.push({
              title: cleanText(topic.Text.split(' - ')[0] || topic.Text.slice(0, 50)),
              url: topic.FirstURL,
              snippet: cleanText(topic.Text),
              content: cleanText(topic.Text),
              quality: getSourceQuality(topic.FirstURL),
              scope: getSourceScope(topic.FirstURL, cleanQuery, topic.Text)
            });
          }
        }
      }
    }
  } catch (ddgErr) {
    console.warn('DuckDuckGo instant answer fallback error:', ddgErr);
  }

  // Rank evidence using the exact 70% coverage + 30% density and Jaccard > 0.72 deduplication
  const evidence = rankEvidence(cleanQuery, rawSources);
  const rawText = formatResearchReport(cleanQuery, rawSources, evidence);

  const overviewSentences = evidence.slice(0, 3).map(e => e.sentence);
  const overview = overviewSentences.length > 0
    ? overviewSentences.join(' ')
    : (rawSources.length > 0 ? 'Relevant sources were found, but no sufficiently relevant evidence sentences could be extracted.' : 'No usable search results were found. Try changing the search query.');

  const findings = evidence.map(e => e.sentence);

  const seen = new Set();
  const uniqueSources = [];
  for (const s of rawSources) {
    if (!seen.has(s.url)) {
      seen.add(s.url);
      uniqueSources.push({
        id: uniqueSources.length + 1,
        title: s.title,
        url: s.url,
        snippet: s.snippet,
        quality: s.quality || getSourceQuality(s.url),
        scope: s.scope || getSourceScope(s.url, cleanQuery),
        sourceDomain: new URL(s.url).hostname.replace('www.', '')
      });
    }
  }

  return {
    query: cleanQuery,
    rawText,
    overview,
    findings,
    sources: uniqueSources,
    results: uniqueSources,
    provider: 'Orange-B Research Engine v3.0'
  };
}
