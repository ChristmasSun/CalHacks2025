const RiskLevels = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
});

function buildAssessment({
  url,
  risk_score,
  risk_level,
  summary = null,
  explanations = [],
  rawSignals = {},
  transcriptSummary = null,
  agentPersona = null
}) {
  return {
    url,
    risk_score,
    risk_level,
     summary,
    explanations,
    rawSignals,
    transcriptSummary,
    agentPersona,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  RiskLevels,
  buildAssessment
};
