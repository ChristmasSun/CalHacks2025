const { RiskLevels, buildAssessment } = require('../shared/types');

const KEYWORD_FLAGS = ['urgent payment', 'irs', 'limited offer', 'gift card', 'wire transfer'];

function scoreFromDomainAge(domainAgeDays) {
  // Handle null/undefined/NaN (when URLScan.io doesn't provide domain age)
  if (!Number.isFinite(domainAgeDays) || domainAgeDays === null) {
    return { score: 0, note: null };
  }

  // Very young domains are highly suspicious
  if (domainAgeDays < 14) {
    return { score: 35, note: `Domain is only ${domainAgeDays} days old (VERY NEW).` };
  }

  // Moderately young domains warrant caution
  if (domainAgeDays < 45) {
    return { score: 20, note: `Domain age (${domainAgeDays} days) is relatively young.` };
  }

  // Older domains get no penalty
  return { score: 0, note: null };
}

function scoreFromRedirects(redirects = []) {
  if (redirects.length <= 1) {
    return { score: 0, note: null };
  }
  if (redirects.length >= 4) {
    return { score: 18, note: `Detected ${redirects.length} redirect hops.` };
  }
  return { score: 12, note: `Detected ${redirects.length} redirects.` };
}

function scoreFromKeywords(keywords = []) {
  const hits = keywords.filter((keyword) =>
    KEYWORD_FLAGS.some((flag) => keyword.toLowerCase().includes(flag))
  );
  if (!hits.length) {
    return { score: 0, note: null };
  }
  return {
    score: Math.min(24, hits.length * 8),
    note: `Flagged keywords: ${hits.join(', ')}.`
  };
}

function scoreFromTranscript(transcript = '') {
  if (!transcript) {
    return { score: 0, note: null };
  }

  const normalized = transcript.toLowerCase();
  const matches = KEYWORD_FLAGS.filter((kw) => normalized.includes(kw));

  if (!matches.length) {
    return { score: 6, note: 'Transcript reviewed, no high-risk language detected.' };
  }

  return {
    score: Math.min(30, matches.length * 10),
    note: `Audio mentions high-risk phrases: ${matches.join(', ')}.`
  };
}

function deriveRiskLevel(score) {
  if (score >= 75) return RiskLevels.HIGH;
  if (score >= 45) return RiskLevels.MEDIUM;
  return RiskLevels.LOW;
}

function scoreRisk(enriched) {
  const explanations = [];
  const rawSignals = {
    brightData: enriched.brightData ?? null,
    sandbox: enriched.sandboxMetadata ?? null,
    agent: enriched.agentFindings ?? null,
    transcript: enriched.transcript ?? null
  };

  let totalScore = 20; // baseline caution

  // URLScan.io security verdicts (highest priority)
  if (enriched.sandboxMetadata?.security) {
    const { malicious, hasPhishing, hasMalware, score } = enriched.sandboxMetadata.security;

    if (malicious) {
      totalScore += 40;
      explanations.push('URLScan.io flagged this URL as malicious.');
    }

    if (hasPhishing) {
      totalScore += 35;
      explanations.push('Phishing attempt detected by URLScan.io analysis.');
    }

    if (hasMalware) {
      totalScore += 35;
      explanations.push('Malware distribution detected by URLScan.io.');
    }

    // Add URLScan score contribution (0-100 scale)
    if (score > 0) {
      const scoreContribution = Math.min(25, Math.round(score / 4));
      totalScore += scoreContribution;
      if (score > 50) {
        explanations.push(`URLScan.io risk score: ${score}/100`);
      }
    }
  }

  const domainAgeSignal = scoreFromDomainAge(enriched.brightData?.whois?.domainAgeDays);
  if (domainAgeSignal.note) {
    explanations.push(domainAgeSignal.note);
    totalScore += domainAgeSignal.score;
  }

  const redirectSignal = scoreFromRedirects(enriched.sandboxMetadata?.redirects || enriched.brightData?.redirects);
  if (redirectSignal.note) {
    explanations.push(redirectSignal.note);
    totalScore += redirectSignal.score;
  }

  const keywordSignal = scoreFromKeywords(enriched.brightData?.keywordMatches);
  if (keywordSignal.note) {
    explanations.push(keywordSignal.note);
    totalScore += keywordSignal.score;
  }

  if (enriched.agentFindings?.verdict === 'high-risk') {
    totalScore += 25;
    explanations.push('Fetch.ai agent rated this URL as high risk.');
  } else if (enriched.agentFindings?.verdict === 'needs-review') {
    totalScore += 12;
    explanations.push('Agent suggests additional review before trusting this URL.');
  }

  if (enriched.sandboxMetadata?.domFlags?.length) {
    const count = enriched.sandboxMetadata.domFlags.length;
    totalScore += Math.min(20, count * 7);
    explanations.push(`Sandbox inspection flagged ${count} suspicious DOM elements.`);
  }

  const transcriptSignal = scoreFromTranscript(enriched.transcript?.transcript);
  if (transcriptSignal.note) {
    explanations.push(transcriptSignal.note);
    totalScore += transcriptSignal.score;
  }

  const risk_score = Math.min(100, Math.round(totalScore));
  const risk_level = deriveRiskLevel(risk_score);

  const summary =
    risk_level === RiskLevels.HIGH
      ? 'High chance of fraud. Do not interact without manual validation.'
      : risk_level === RiskLevels.MEDIUM
      ? 'Moderate risk indicators present. Proceed with strong caution.'
      : 'Low risk detected, but remain vigilant for unexpected changes.';

  return buildAssessment({
    url: enriched.url,
    risk_score,
    risk_level,
    summary,
    explanations,
    rawSignals,
    transcriptSummary: enriched.transcript?.transcript ?? null,
    agentPersona: enriched.agentFindings?.persona ?? null
  });
}

module.exports = {
  scoreRisk
};
