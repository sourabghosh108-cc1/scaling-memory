"""
ORANGE-B RESEARCH ENGINE v3.0
(Formerly Needle Research Engine v3.0)

Features:
- Web research using DDGS
- Webpage crawling and extraction
- SQLite search cache and local knowledge base (Vercel serverless compatible)
- Evidence extraction and ranking (70% coverage + 30% density)
- Jaccard similarity deduplication (threshold > 0.72)
- Descriptive research answers with source classifications and geographical scope
- Comparisons and claim verification
- Vercel Serverless Function HTTP handler
"""

from __future__ import annotations

import ast
import json
import math
import operator
import os
import re
import sqlite3
import statistics
import sys
import tempfile
import time

from collections import deque
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import requests
from bs4 import BeautifulSoup
from ddgs import DDGS


# ============================================================
# CONFIGURATION
# ============================================================

APP_NAME = "Orange-B"
VERSION = "3.0"

# Vercel serverless functions have a read-only filesystem except for /tmp
DB_DIR = "/tmp" if os.path.exists("/tmp") else tempfile.gettempdir()
DATABASE = os.path.join(DB_DIR, "needle.db")

MAX_SEARCH_RESULTS = 10
MAX_CRAWL_PAGES = 5
MAX_PAGE_CHARS = 15000
TIMEOUT = 12

HISTORY = deque(maxlen=10)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 "
        "(Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 "
        "(KHTML, like Gecko) "
        "Chrome/120.0 Safari/537.36"
    )
}


# ============================================================
# DATABASE & CACHE
# ============================================================

def database():
    connection = sqlite3.connect(DATABASE)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS cache (
            query TEXT PRIMARY KEY,
            data TEXT,
            created REAL
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS knowledge (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            url TEXT UNIQUE,
            content TEXT,
            created REAL
        )
    """)

    connection.commit()
    return connection


def cache_get(query):
    try:
        connection = database()
        row = connection.execute(
            "SELECT data, created FROM cache WHERE query=?",
            (query.lower().strip(),)
        ).fetchone()
        connection.close()

        if not row:
            return None

        data, created = row

        # Cache expires after 30 minutes.
        if time.time() - created > 1800:
            return None

        return json.loads(data)
    except Exception:
        return None


def cache_set(query, data):
    try:
        connection = database()
        connection.execute("""
            INSERT OR REPLACE INTO cache
            (query, data, created)
            VALUES (?, ?, ?)
        """, (
            query.lower().strip(),
            json.dumps(data),
            time.time()
        ))
        connection.commit()
        connection.close()
    except Exception:
        pass


# ============================================================
# TEXT PROCESSING
# ============================================================

STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were",
    "what", "why", "how", "who", "when", "where",
    "which", "does", "do", "did", "can", "could",
    "would", "should", "about", "for", "to", "of",
    "in", "on", "at", "and", "or", "with", "from",
    "by", "it", "this", "that", "these", "those",
    "please", "give", "show", "explain", "tell",
    "me", "find", "search"
}


def terms(text):
    words = re.findall(
        r"[a-zA-Z0-9][a-zA-Z0-9'-]*",
        str(text).lower()
    )

    return {
        word for word in words
        if len(word) > 2 and word not in STOP_WORDS
    }


def split_sentences(text):
    sentences = re.split(
        r"(?<=[.!?])\s+(?=[A-Z0-9])",
        str(text).strip()
    )

    return [
        sentence.strip()
        for sentence in sentences
        if len(sentence.strip()) > 30
    ]


def clean_text(text):
    text = re.sub(r"\s+", " ", str(text))
    return text.strip()


# ============================================================
# SOURCE QUALITY & GEOGRAPHICAL SCOPE
# ============================================================

def source_quality(url):
    domain = urlparse(url).netloc.lower()

    if domain.endswith(".gov") or ".gov." in domain:
        return "Government source"

    if domain.endswith(".edu") or ".edu." in domain:
        return "Educational source"

    if domain.endswith(".ac.in"):
        return "Academic source"

    if domain.endswith(".gov.in"):
        return "Indian government source"

    if "wikipedia.org" in domain:
        return "Encyclopedia"

    return "Web source"


def source_scope(url, query="", snippet=""):
    """
    Distinguishes geographical scope:
    - Local: relevant to a specific locality, city, district or region.
    - National: relevant to a particular country.
    - International: relevant across countries or globally.
    """
    domain = urlparse(url).netloc.lower()
    combined = f"{domain} {query} {snippet[:200]}".lower()

    # Local indicators
    local_patterns = [
        r"\b(?:city|district|municipality|local|neighborhood|borough|county|ward)\b",
        r"\b(?:delhi|mumbai|bengaluru|kolkata|chennai|hyderabad|tokyo|london|paris|new york)\b"
    ]
    for pat in local_patterns:
        if re.search(pat, combined):
            return "Local"

    # International indicators
    international_domains = [
        "un.org", "who.int", "unesco.org", "worldbank.org", "imf.org", "wto.org",
        "oecd.org", "nature.com", "sciencedirect.com", "arxiv.org", "ieee.org"
    ]
    if any(ind in domain for ind in international_domains):
        return "International"

    # National indicators (country code TLDs and national governmental/educational assets)
    national_tlds = [
        ".in", ".gov.in", ".ac.in", ".gov", ".uk", ".gov.uk", ".ac.uk",
        ".us", ".ca", ".gc.ca", ".au", ".gov.au", ".edu.au", ".de", ".fr", ".jp"
    ]
    for tld in national_tlds:
        if domain.endswith(tld) or f"{tld}." in domain:
            return "National"

    return "International" if "wikipedia.org" in domain else "National"


# ============================================================
# WEB SEARCH
# ============================================================

def search_web(query, limit=MAX_SEARCH_RESULTS):
    cached = cache_get(query)
    if cached is not None:
        return cached

    results = []

    try:
        raw_results = DDGS().text(
            query,
            max_results=limit
        )

        for item in raw_results:
            title = item.get("title", "Untitled source")
            url = (
                item.get("href")
                or item.get("url")
                or ""
            )
            snippet = (
                item.get("body")
                or item.get("snippet")
                or ""
            )

            if not url:
                continue

            results.append({
                "title": clean_text(title),
                "url": url.strip(),
                "snippet": clean_text(snippet),
                "quality": source_quality(url),
                "scope": source_scope(url, query, snippet)
            })

    except Exception as error:
        print("Search error:", type(error).__name__, str(error))

    cache_set(query, results)
    return results


# ============================================================
# WEBPAGE CRAWLER
# ============================================================

def crawl_page(url):
    try:
        response = requests.get(
            url,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type.lower():
            return ""

        soup = BeautifulSoup(
            response.text,
            "html.parser"
        )

        for element in soup([
            "script",
            "style",
            "nav",
            "footer",
            "header",
            "aside",
            "noscript"
        ]):
            element.decompose()

        content = soup.get_text(
            separator=" ",
            strip=True
        )

        return clean_text(content)[:MAX_PAGE_CHARS]

    except requests.RequestException:
        return ""
    except Exception:
        return ""


# ============================================================
# LOCAL KNOWLEDGE BASE
# ============================================================

def save_knowledge(title, url, content):
    if not content:
        return

    try:
        connection = database()
        connection.execute("""
            INSERT OR REPLACE INTO knowledge
            (title, url, content, created)
            VALUES (?, ?, ?, ?)
        """, (
            title,
            url,
            content,
            time.time()
        ))
        connection.commit()
        connection.close()
    except Exception:
        pass


def search_knowledge(query, limit=5):
    try:
        connection = database()
        rows = connection.execute("""
            SELECT title, url, content
            FROM knowledge
            ORDER BY created DESC
            LIMIT 100
        """).fetchall()
        connection.close()
    except Exception:
        return []

    query_terms = terms(query)
    ranked = []

    for title, url, content in rows:
        content_terms = terms(title + " " + content)
        overlap = len(query_terms & content_terms)

        if overlap:
            score = overlap / max(1, len(query_terms))
            ranked.append((
                score,
                title,
                url,
                content
            ))

    ranked.sort(
        key=lambda item: item[0],
        reverse=True
    )

    return ranked[:limit]


# ============================================================
# RESEARCH COLLECTION
# ============================================================

def collect_sources(query):
    sources = search_web(query)
    collected = []

    for source in sources[:MAX_CRAWL_PAGES]:
        content = crawl_page(source["url"])

        if content:
            source["content"] = content
            save_knowledge(
                source["title"],
                source["url"],
                content
            )
        else:
            source["content"] = source["snippet"]

        collected.append(source)

    return collected


# ============================================================
# EVIDENCE EXTRACTION & RANKING
# ============================================================

def rank_evidence(query, sources):
    query_terms = terms(query)
    ranked = []

    for source in sources:
        content = (
            source.get("content", "")
            or source.get("snippet", "")
        )

        sentences = split_sentences(content)

        for sentence in sentences:
            sentence_terms = terms(sentence)
            if not sentence_terms:
                continue

            overlap = len(query_terms & sentence_terms)
            coverage = overlap / max(1, len(query_terms))
            density = overlap / max(1, len(sentence_terms))

            score = (
                coverage * 0.7
                + density * 0.3
            )

            if score > 0:
                ranked.append({
                    "score": score,
                    "sentence": sentence,
                    "source": source
                })

    ranked.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    selected = []
    seen_terms = []

    for item in ranked:
        current = terms(item["sentence"])
        duplicate = False

        for previous in seen_terms:
            similarity = len(
                current & previous
            ) / max(
                1,
                len(current | previous)
            )

            if similarity > 0.72:
                duplicate = True
                break

        if duplicate:
            continue

        selected.append(item)
        seen_terms.append(current)

        if len(selected) >= 6:
            break

    return selected


# ============================================================
# RESEARCH ANSWER FORMATTER
# ============================================================

def format_research(query, sources, evidence=None):
    if not sources:
        return (
            "No usable search results were found. "
            "Try changing the search query."
        )

    if evidence is None:
        evidence = rank_evidence(query, sources)

    lines = []

    lines.append("RESEARCH OVERVIEW")
    lines.append("=" * 55)

    if evidence:
        overview = []
        for item in evidence[:3]:
            overview.append(item["sentence"])
        lines.append(" ".join(overview))
    else:
        lines.append(
            "Relevant sources were found, "
            "but no sufficiently relevant evidence "
            "sentences could be extracted."
        )

    lines.append("")
    lines.append("KEY FINDINGS")
    lines.append("=" * 55)

    for index, item in enumerate(evidence, start=1):
        lines.append(f"{index}. {item['sentence']}")

    lines.append("")
    lines.append("SOURCES")
    lines.append("=" * 55)

    seen = set()
    number = 1

    for source in sources:
        url = source["url"]
        if url in seen:
            continue
        seen.add(url)

        lines.append(f"[{number}] {source['title']}")
        lines.append(f"    {url}")
        lines.append(f"    Type: {source['quality']}")
        number += 1

    lines.append("")
    lines.append(
        "Note: The overview is generated from retrieved "
        "evidence. It is not an independent factual "
        "verification or an LLM-generated synthesis."
    )

    return "\n".join(lines)


# ============================================================
# RESEARCH
# ============================================================

def research(query):
    sources = collect_sources(query)

    # Include relevant local knowledge.
    local_results = search_knowledge(query)

    for score, title, url, content in local_results:
        if not any(source["url"] == url for source in sources):
            sources.append({
                "title": title,
                "url": url,
                "snippet": content[:1000],
                "content": content,
                "quality": source_quality(url),
                "scope": source_scope(url, query, content)
            })

    evidence = rank_evidence(query, sources)
    raw_text = format_research(query, sources, evidence)

    # Prepare overview
    overview_sentences = [item["sentence"] for item in evidence[:3]]
    overview_text = " ".join(overview_sentences) if overview_sentences else (
        "Relevant sources were found, but no sufficiently relevant evidence sentences could be extracted."
        if sources else "No usable search results were found. Try changing the search query."
    )

    findings_list = [item["sentence"] for item in evidence]

    # Unique sources for structured UI
    seen = set()
    unique_sources = []
    for s in sources:
        u = s.get("url")
        if u and u not in seen:
            seen.add(u)
            unique_sources.append({
                "id": len(unique_sources) + 1,
                "title": s.get("title", "Untitled source"),
                "url": u,
                "snippet": s.get("snippet", ""),
                "quality": s.get("quality", source_quality(u)),
                "scope": s.get("scope", source_scope(u, query)),
                "sourceDomain": urlparse(u).netloc.replace("www.", "")
            })

    return {
        "query": query,
        "rawText": raw_text,
        "overview": overview_text,
        "findings": findings_list,
        "sources": unique_sources,
        "results": unique_sources,
        "provider": "Orange-B Research Engine v3.0"
    }


# ============================================================
# COMPARISON
# ============================================================

def compare(query):
    match = re.search(
        r"(.+?)\s+(?:vs\.?|versus|compared with|compared to)\s+(.+)",
        query,
        re.IGNORECASE
    )

    if not match:
        return "Comparison format not recognised. Try: Topic A vs Topic B"

    first = match.group(1).strip()
    second = match.group(2).strip()

    first_sources = collect_sources(first)
    second_sources = collect_sources(second)

    first_answer = format_research(first, first_sources)
    second_answer = format_research(second, second_sources)

    return (
        "COMPARATIVE RESEARCH\n"
        + "=" * 55
        + "\n\n"
        + "SUBJECT A: "
        + first
        + "\n\n"
        + first_answer
        + "\n\n"
        + "=" * 55
        + "\n\n"
        + "SUBJECT B: "
        + second
        + "\n\n"
        + second_answer
    )


# ============================================================
# CLAIM VERIFICATION
# ============================================================

def verify_claim(query):
    claim = re.sub(
        r"^(verify|fact check|fact-check|check whether|is it true that)\s*",
        "",
        query,
        flags=re.IGNORECASE
    ).strip()

    sources = collect_sources(claim)

    if not sources:
        return (
            "VERIFICATION INCONCLUSIVE\n"
            "No relevant sources were found."
        )

    evidence = rank_evidence(claim, sources)

    output = [
        "CLAIM VERIFICATION",
        "=" * 55,
        f"Claim: {claim}",
        "",
        "RETRIEVED EVIDENCE"
    ]

    if evidence:
        for index, item in enumerate(evidence, start=1):
            output.append(f"{index}. {item['sentence']}")
    else:
        output.append("No sufficiently relevant evidence extracted.")

    output.extend(["", "SOURCES"])

    for source in sources:
        output.append(f"{source['title']}: {source['url']}")

    output.extend([
        "",
        "STATUS: EVIDENCE REVIEW REQUIRED",
        "The search engine retrieves and ranks evidence. "
        "It does not independently establish truth."
    ])

    return "\n".join(output)


# ============================================================
# VERCEL SERVERLESS HANDLER
# ============================================================

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT")
        self.send_header(
            "Access-Control-Allow-Headers",
            "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
        )
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        query = (
            params.get("q", [""])[0]
            or params.get("query", [""])[0]
        ).strip()

        if not query:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Query parameter 'q' is required"}).encode("utf-8"))
            return

        try:
            lower = query.lower()
            if re.search(r"\b(vs\.?|versus|compared with|compared to)\b", lower):
                raw_out = compare(query)
                res = {
                    "query": query,
                    "rawText": raw_out,
                    "overview": raw_out[:300],
                    "findings": [],
                    "sources": [],
                    "results": [],
                    "provider": "Orange-B Comparison Engine"
                }
            elif re.search(r"\b(verify|fact check|fact-check|check whether)\b", lower):
                raw_out = verify_claim(query)
                res = {
                    "query": query,
                    "rawText": raw_out,
                    "overview": raw_out[:300],
                    "findings": [],
                    "sources": [],
                    "results": [],
                    "provider": "Orange-B Verification Engine"
                }
            else:
                res = research(query)

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))

        except Exception as err:
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(err)}).encode("utf-8"))

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        query = (data.get("q") or data.get("query") or "").strip()
        if not query:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Query parameter 'q' is required"}).encode("utf-8"))
            return

        try:
            res = research(query)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
        except Exception as err:
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(err)}).encode("utf-8"))


# ============================================================
# CLI RUNNER
# ============================================================

def main():
    print("=" * 60)
    print(f"{APP_NAME} RESEARCH ENGINE v{VERSION}")
    print("=" * 60)

    while True:
        try:
            query = input("\nYou: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nOrange-B terminated.")
            break

        if not query:
            continue

        if query.lower() in {"exit", "quit"}:
            print("Orange-B terminated.")
            break

        try:
            res = research(query)
            print("\nORANGE-B:\n")
            print(res["rawText"])
        except Exception as error:
            print("\nORANGE-B ERROR:", f"{type(error).__name__}: {error}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        q = " ".join(sys.argv[1:])
        result = research(q)
        print(json.dumps(result))
    else:
        main()
