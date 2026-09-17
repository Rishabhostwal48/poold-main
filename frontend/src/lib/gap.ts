import type {
  CandidateProfile,
  JobProfile,
} from "@/types";

// ---- Types you can reuse in UI ----
export type GapCoverage = "covered" | "weak" | "unknown";
export type EvidenceSource = "CV" | "Interview" | "JD";
export type Evidence = {
  quote: string;
  source: EvidenceSource;
  where?: string;       // e.g., "Role: Senior Eng @ Foo (2022–2024)"
  score: number;        // 0..1 similarity
};
export type GapItem = {
  requirement: string;
  coverage: GapCoverage;
  score: number;        // 0..1, best evidence score
  evidence: Evidence[]; // top N
};
export type RobustGapAnalysis = {
  items: GapItem[];
  summary: { covered: number; weak: number; unknown: number };
};

// ---- Normalization helpers ----
const deburr = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalize = (s: string) =>
  deburr(s)
    .toLowerCase()
    .replace(/[^a-z0-9+.#\- ]+/g, " ") // keep + . # - for things like c++, .net
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (s: string) => normalize(s).split(" ").filter(Boolean);

// ---- Alias map (extend as needed) ----
const ALIASES: Record<string, string[]> = {
  javascript: ["js", "nodejs", "node.js", "node"],
  typescript: ["ts"],
  python: ["py"],
  postgresql: ["postgres", "psql", "postgresql"],
  mysql: ["maria", "mariadb"],
  aws: ["amazon web services"],
  gcp: ["google cloud", "google cloud platform"],
  azure: ["microsoft azure"],
  kubernetes: ["k8s"],
  docker: ["containers", "containerization"],
  ci_cd: ["ci/cd", "cicd", "continuous integration", "continuous delivery"],
  react: ["react.js", "reactjs"],
  nextjs: ["next", "next.js"],
  openai: ["gpt-4", "gpt-4o", "gpt4o", "chatgpt", "oai"],
  langchain: ["lc", "langchainjs", "langchain.py"],
  vector: ["faiss", "pgvector", "pinecone", "milvus", "weaviate", "chroma"],
  llm_evals: ["evals", "rubrics", "quality metrics", "hallucination rate"],
  prompt_engineering: ["prompting", "system prompt", "few-shot"],
  guardrails: ["input validation", "moderation", "red-teaming", "safety"],
};

// Expand requirement into canonical + aliases
function expandRequirement(req: string): string[] {
  const r = normalize(req);
  const hits: string[] = [r];
  // look for key in ALIASES by best match
  for (const [canon, al] of Object.entries(ALIASES)) {
    if (r === canon || al.some((x) => r.includes(normalize(x)))) {
      hits.push(canon, ...al.map(normalize));
    }
  }
  return Array.from(new Set(hits));
}

// ---- Similarity (Dice coefficient on bigrams) ----
function bigrams(s: string): Set<string> {
  const t = normalize(s).replace(/ /g, "_");
  const bg = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) bg.add(t.slice(i, i + 2));
  return bg;
}
function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size && !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}

// ---- Evidence extraction from candidate + transcript ----
export type TranscriptItem = {
  text: string;
  speaker: "candidate" | "interviewer";
  ts?: string;
};

function collectCvSnippets(cand: CandidateProfile): Evidence[] {
  const out: Evidence[] = [];
  // skills buckets
  for (const [bucket, skills] of Object.entries(cand.skills || {})) {
    if (!skills) continue;
    out.push({
      quote: `Skills[${bucket}]: ${skills.join(", ")}`,
      source: "CV",
      where: "Skills",
      score: 0,
    });
  }
  // roles + achievements
  for (const r of cand.roles || []) {
    const head = `${r.title} @ ${r.company} (${r.start ?? ""}–${r.end ?? ""})`.trim();
    if (r.achievements?.length) {
      for (const a of r.achievements) {
        out.push({
          quote: a,
          source: "CV",
          where: `Role: ${head}`,
          score: 0,
        });
      }
    }
    const toolLine = (r.tools || []).join(", ");
    if (toolLine) {
      out.push({
        quote: `Tools: ${toolLine}`,
        source: "CV",
        where: `Role: ${head}`,
        score: 0,
      });
    }
  }
  // highlights (STAR)
  for (const h of cand.highlights || []) {
    const q = [h.situation, h.task, h.action, h.result].filter(Boolean).join(" ");
    if (q) {
      out.push({
        quote: q,
        source: "CV",
        where: "STAR",
        score: 0,
      });
    }
  }
  return out;
}

function collectTranscriptSnippets(transcript: TranscriptItem[] = []): Evidence[] {
  return transcript
    .filter((t) => t.speaker === "candidate" && t.text && t.text.length > 10)
    .map((t) => ({
      quote: t.text,
      source: "Interview" as EvidenceSource,
      where: t.ts ? `@${t.ts}` : "Interview",
      score: 0,
    }));
}

// ---- Core: compute robust gap analysis ----
export function computeGapAnalysis(params: {
  candidate: CandidateProfile;
  job: JobProfile;
  transcript?: TranscriptItem[];
  maxEvidencePerReq?: number;
  weakThreshold?: number;  // default 0.35
  coveredThreshold?: number; // default 0.6
}): RobustGapAnalysis {
  const {
    candidate,
    job,
    transcript = [],
    maxEvidencePerReq = 4,
    weakThreshold = 0.35,
    coveredThreshold = 0.6,
  } = params;

  const corpus: Evidence[] = [
    ...collectCvSnippets(candidate),
    ...collectTranscriptSnippets(transcript),
  ];

  const items: GapItem[] = [];

  for (const reqRaw of job.must_haves || []) {
    const reqForms = expandRequirement(reqRaw);
    const scored: Evidence[] = [];

    // score each evidence snippet against requirement forms; keep best score
    for (const ev of corpus) {
      let best = 0;
      for (const rf of reqForms) {
        // quick exact/substring boosts
        const q = normalize(ev.quote);
        if (q.includes(rf)) {
          best = Math.max(best, 0.85); // strong substring match
        } else {
          best = Math.max(best, dice(rf, q));
        }
      }
      if (best > 0) {
        scored.push({ ...ev, score: best });
      }
    }

    // sort by score desc and keep top few; also trim long quotes
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, maxEvidencePerReq).map((e) => ({
      ...e,
      quote: e.quote.length > 280 ? e.quote.slice(0, 277) + "…" : e.quote,
    }));
    const bestScore = top[0]?.score ?? 0;

    let coverage: GapCoverage = "unknown";
    if (bestScore >= coveredThreshold) coverage = "covered";
    else if (bestScore >= weakThreshold) coverage = "weak";

    items.push({
      requirement: reqRaw,
      coverage,
      score: Number(bestScore.toFixed(3)),
      evidence: top,
    });
  }

  // Optional: nice-haves (score but don't count in summary)
  for (const reqRaw of job.nice_haves || []) {
    const reqForms = expandRequirement(reqRaw);
    const scored: Evidence[] = [];
    for (const ev of corpus) {
      let best = 0;
      for (const rf of reqForms) {
        const q = normalize(ev.quote);
        best = Math.max(best, q.includes(rf) ? 0.8 : dice(rf, q));
      }
      if (best > 0) scored.push({ ...ev, score: best });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, maxEvidencePerReq);
    items.push({
      requirement: `(nice) ${reqRaw}`,
      coverage: top[0]?.score ? (top[0].score >= coveredThreshold ? "covered" : "weak") : "unknown",
      score: Number((top[0]?.score ?? 0).toFixed(3)),
      evidence: top,
    });
  }

  const summary = {
    covered: items.filter((i) => i.coverage === "covered").length,
    weak: items.filter((i) => i.coverage === "weak").length,
    unknown: items.filter((i) => i.coverage === "unknown").length,
  };

  return { items, summary };
}
