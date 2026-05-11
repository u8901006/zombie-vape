#!/usr/bin/env node
import { execSync } from "child_process";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

const SEARCH_QUERIES = [
  `(("etomidate"[Title/Abstract] OR "etomidate"[MeSH Terms] OR "propoxate"[Title/Abstract] OR "isopropoxate"[Title/Abstract] OR "metomidate"[Title/Abstract] OR "space oil"[Title/Abstract] OR "Kpod"[Title/Abstract] OR "Kpods"[Title/Abstract] OR "zombie vape"[Title/Abstract] OR "zombie vapes"[Title/Abstract] OR "drug-laced vape"[Title/Abstract] OR "drug-laced vaping"[Title/Abstract]) AND ("electronic cigarette"[Title/Abstract] OR "electronic cigarettes"[Title/Abstract] OR "e-cigarette"[Title/Abstract] OR "e-cigarettes"[Title/Abstract] OR "vape"[Title/Abstract] OR "vaping"[Title/Abstract] OR "vape cartridge"[Title/Abstract] OR "e-liquid"[Title/Abstract] OR "Electronic Nicotine Delivery Systems"[MeSH Terms] OR "Vaping"[MeSH Terms]))`,
];

const HEADERS = "User-Agent: ZombieVapeBot/1.0 (research aggregator)";

function getDateStr(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

function fetchJSON(url) {
  const tmpFile = resolve(ROOT, `_fetch_tmp_${Date.now()}.json`);
  try {
    execSync(`curl -sS -H "${HEADERS}" -o "${tmpFile}" "${url}"`, {
      timeout: 30000,
      encoding: "utf-8",
    });
    const raw = readFileSync(tmpFile, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[ERROR] fetchJSON failed for ${url}: ${e.message}`);
    return null;
  } finally {
    if (existsSync(tmpFile)) {
      try {
        import("fs").then((fs) => fs.unlinkSync(tmpFile));
      } catch {}
    }
  }
}

function fetchXML(url) {
  const tmpFile = resolve(ROOT, `_fetch_tmp_${Date.now()}.xml`);
  try {
    execSync(`curl -sS -H "${HEADERS}" -o "${tmpFile}" "${url}"`, {
      timeout: 60000,
      encoding: "utf-8",
    });
    return readFileSync(tmpFile, "utf-8");
  } catch (e) {
    console.error(`[ERROR] fetchXML failed: ${e.message}`);
    return "";
  } finally {
    if (existsSync(tmpFile)) {
      try {
        import("fs").then((fs) => fs.unlinkSync(tmpFile));
      } catch {}
    }
  }
}

function searchPapers(query, retmax = 50) {
  const encoded = encodeURIComponent(query);
  const url = `${BASE_URL}/esearch.fcgi?db=pubmed&term=${encoded}&retmax=${retmax}&sort=date&retmode=json`;
  console.error("[INFO] Searching PubMed...");
  const data = fetchJSON(url);
  if (!data || !data.esearchresult) {
    console.error("[ERROR] PubMed search returned no data");
    return [];
  }
  const ids = data.esearchresult.idlist || [];
  console.error(`[INFO] Found ${ids.length} PMIDs`);
  return ids;
}

function parseXMLPapers(xml) {
  const papers = [];
  const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
  let match;
  while ((match = articleRegex.exec(xml)) !== null) {
    const block = match[1];
    const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    const pmid = pmidMatch ? pmidMatch[1] : "";
    const titleMatch = block.match(
      /<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/
    );
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
    const journalMatch = block.match(/<Title>([\s\S]*?)<\/Title>/);
    const journal = journalMatch ? journalMatch[1].trim() : "";
    const abstractParts = [];
    const absRegex = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
    let absMatch;
    while ((absMatch = absRegex.exec(block)) !== null) {
      const labelMatch = absMatch[0].match(/Label="([^"]*)"/);
      const label = labelMatch ? labelMatch[1] : "";
      const text = absMatch[1].replace(/<[^>]+>/g, "").trim();
      if (label && text) {
        abstractParts.push(`${label}: ${text}`);
      } else if (text) {
        abstractParts.push(text);
      }
    }
    const abstract = abstractParts.join(" ").slice(0, 2000);
    let dateStr = "";
    const pubDateMatch = block.match(
      /<PubDate>([\s\S]*?)<\/PubDate>/
    );
    if (pubDateMatch) {
      const pd = pubDateMatch[1];
      const y = pd.match(/<Year>(\d+)<\/Year>/);
      const m = pd.match(/<Month>([\w]+)<\/Month>/);
      const d = pd.match(/<Day>(\d+)<\/Day>/);
      const parts = [];
      if (y) parts.push(y[1]);
      if (m) parts.push(m[1]);
      if (d) parts.push(d[1]);
      dateStr = parts.join(" ");
    }
    const keywords = [];
    const kwRegex = /<Keyword>([\s\S]*?)<\/Keyword>/g;
    let kwMatch;
    while ((kwMatch = kwRegex.exec(block)) !== null) {
      keywords.push(kwMatch[1].trim());
    }
    papers.push({
      pmid,
      title,
      journal,
      date: dateStr,
      abstract,
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "",
      keywords,
    });
  }
  return papers;
}

function fetchDetails(pmids) {
  if (!pmids.length) return [];
  const ids = pmids.join(",");
  const url = `${BASE_URL}/efetch.fcgi?db=pubmed&id=${ids}&retmode=xml`;
  console.error("[INFO] Fetching paper details...");
  const xml = fetchXML(url);
  if (!xml) return [];
  return parseXMLPapers(xml);
}

function main() {
  const args = process.argv.slice(2);
  let days = 7;
  let maxPapers = 40;
  let outputFile = resolve(ROOT, "papers.json");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--max-papers" && args[i + 1]) {
      maxPapers = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--output" && args[i + 1]) {
      outputFile = resolve(ROOT, args[i + 1]);
      i++;
    }
  }

  const allPMIDs = new Set();
  for (const query of SEARCH_QUERIES) {
    const dateFilter = ` AND "${getDateStr(days)}"[Date - Publication] : "3000"[Date - Publication]`;
    const pmids = searchPapers(query + dateFilter, maxPapers);
    pmids.forEach((id) => allPMIDs.add(id));
  }

  const pmidList = [...allPMIDs];
  console.error(`[INFO] Unique PMIDs: ${pmidList.length}`);

  let papers = [];
  if (pmidList.length > 0) {
    papers = fetchDetails(pmidList);
  }

  const dateStr = getDateStr(0);
  const output = {
    date: dateStr,
    count: papers.length,
    papers,
  };

  writeFileSync(outputFile, JSON.stringify(output, null, 2), "utf-8");
  console.error(`[INFO] Saved ${papers.length} papers to ${outputFile}`);
}

main();
