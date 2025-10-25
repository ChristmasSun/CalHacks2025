/**
 * Risk Scoring Engine
 *
 * SCORING PHILOSOPHY:
 * We HEAVILY prioritize URLScan.io's expert verdicts over custom heuristics.
 * URLScan.io analyzes millions of URLs with 70+ security engines in isolated VMs.
 *
 * Priority levels:
 * 1. URLScan.io malicious/phishing/malware verdicts (score 90-95) - TRUST THE EXPERTS
 * 2. URLScan.io risk score (0-100) - Use as baseline
 * 3. Domain age, DOM flags, transcripts - Small adjustments only
 * 4. Redirects, mock signals - Informational weight only
 *
 * This approach:
 * - Reduces false positives (URLScan.io is battle-tested)
 * - Makes scoring more transparent and explainable
 * - Avoids double-counting signals URLScan.io already considers
 */

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

// NOTE: Keyword matching removed - URLScan.io already analyzes page content
// and flags suspicious keywords. No need to duplicate this logic.

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

  const urlscanSecurity = enriched.sandboxMetadata?.security;
  let totalScore = 0;

  // ========================================
  // PRIORITY 1: URLScan.io Verdicts (TRUST THE EXPERTS)
  // ========================================

  // If URLScan.io definitively says malicious, that's HIGH RISK
  if (urlscanSecurity?.malicious) {
    totalScore = 95; // Almost certain threat
    explanations.push('⚠️ URLScan.io flagged this URL as MALICIOUS.');
  }
  // If URLScan.io detects phishing or malware, also HIGH RISK
  else if (urlscanSecurity?.hasPhishing) {
    totalScore = 90;
    explanations.push('⚠️ Phishing attempt detected by URLScan.io VM analysis.');
  }
  else if (urlscanSecurity?.hasMalware) {
    totalScore = 90;
    explanations.push('⚠️ Malware distribution detected by URLScan.io.');
  }
  // Use URLScan.io's own risk score as baseline (0-100)
  else if (urlscanSecurity?.score !== undefined && urlscanSecurity.score > 0) {
    totalScore = urlscanSecurity.score;
    if (urlscanSecurity.score > 50) {
      explanations.push(`URLScan.io risk score: ${urlscanSecurity.score}/100`);
    }
  }
  // No URLScan data available - start with LOW baseline (not enough data to judge)
  else {
    totalScore = 10; // Low baseline when data is limited
    explanations.push('Limited threat intelligence available - URL appears normal but analysis is incomplete.');
  }

  // ========================================
  // PRIORITY 2: High-Value Signals (Small Adjustments)
  // ========================================

  // Only add domain age penalty if URLScan didn't already flag as malicious
  if (totalScore < 80) {
    const domainAgeSignal = scoreFromDomainAge(enriched.brightData?.whois?.domainAgeDays);
    if (domainAgeSignal.note) {
      explanations.push(domainAgeSignal.note);
      // Reduce weight - URLScan.io already considers this
      totalScore += Math.round(domainAgeSignal.score * 0.4); // 40% weight
    }
  }

  // Suspicious DOM elements (login forms, etc.)
  if (enriched.sandboxMetadata?.domFlags?.length) {
    const count = enriched.sandboxMetadata.domFlags.length;
    const domScore = Math.min(15, count * 5); // Max 15 points
    totalScore += domScore;
    explanations.push(`Detected ${count} suspicious element(s) (login forms, credential inputs).`);
  }

  // ========================================
  // Bright Data Threat Intelligence
  // ========================================
  const brightDataIndicators = enriched.brightData?.indicators;
  if (brightDataIndicators && totalScore < 85) {
    // Apply Bright Data's risk score with moderate weight (URLScan.io is still primary)
    const bdScore = brightDataIndicators.score || 0;

    if (bdScore > 0) {
      // Add 40% of Bright Data's score (max 40 points if BD score is 100)
      const weightedBDScore = Math.round(bdScore * 0.4);
      totalScore += weightedBDScore;

      // Add specific explanations for detected indicators
      if (brightDataIndicators.hasPasswordField || brightDataIndicators.hasCreditCardForm) {
        explanations.push('⚠️ Bright Data detected credential/payment harvesting forms.');
      }
      if (brightDataIndicators.misleadingTitle) {
        explanations.push('Bright Data flagged potential brand impersonation in page title.');
      }
      if (brightDataIndicators.urgencyLanguage) {
        explanations.push('Bright Data detected urgency/pressure language (common in scams).');
      }
      if (brightDataIndicators.suspiciousScripts) {
        explanations.push('Bright Data found obfuscated/suspicious JavaScript code.');
      }
      if (bdScore > 20 && !explanations.some(e => e.includes('Bright Data'))) {
        explanations.push(`Bright Data threat analysis: ${bdScore}/100 risk score.`);
      }
    }
  }

  // Audio transcript analysis (for voice scams)
  const transcriptSignal = scoreFromTranscript(enriched.transcript?.transcript);
  if (transcriptSignal.note) {
    explanations.push(transcriptSignal.note);
    totalScore += transcriptSignal.score;
  }

  // ========================================
  // PRIORITY 3: Low-Value Signals (Informational Only)
  // ========================================

  // Redirects - informational only, minimal weight
  const redirectSignal = scoreFromRedirects(enriched.sandboxMetadata?.redirects || enriched.brightData?.redirects);
  if (redirectSignal.note && totalScore < 70) {
    explanations.push(redirectSignal.note + ' (informational)');
    totalScore += Math.round(redirectSignal.score * 0.3); // 30% weight
  }

  // Mock agent findings (currently fake data)
  if (enriched.agentFindings?.verdict === 'high-risk' && totalScore < 70) {
    totalScore += 10; // Reduced weight since it's mock data
    explanations.push('Agent flagged as potentially risky.');
  }

  // Cap the final score at 100
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
