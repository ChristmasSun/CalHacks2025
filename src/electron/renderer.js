const statusNode = document.getElementById('status');
const scoreNode = document.getElementById('score');
const levelNode = document.getElementById('level');
const summaryNode = document.getElementById('summary');
const explanationsList = document.getElementById('explanations');
const transcriptNode = document.getElementById('transcript-output');
const agentPersonaNode = document.getElementById('agent-persona');
const dropZone = document.getElementById('drop-zone');
const urlInput = document.getElementById('url-input');
const form = document.getElementById('analyze-form');
const analyzeButton = document.getElementById('analyze-button');

const hasBridge = Boolean(window.scamShield);

if (!hasBridge) {
  statusNode.textContent = 'IPC bridge unavailable. Reload the app.';
  analyzeButton?.setAttribute('disabled', 'true');
}

function setLoading(isLoading, message = 'Analyzing...', options = {}) {
  const { highlightDropZone = false } = options;

  if (isLoading) {
    statusNode.textContent = message;
    analyzeButton?.setAttribute('disabled', 'true');
    if (highlightDropZone) {
      dropZone?.classList.add('dragover');
    }
  } else {
    dropZone?.classList.remove('dragover');
    analyzeButton?.removeAttribute('disabled');
  }
}

function renderAssessment(assessment) {
  if (!assessment) {
    return;
  }

  scoreNode.textContent = assessment.risk_score ?? '0';
  levelNode.textContent = (assessment.risk_level ?? 'unknown').toUpperCase();
  summaryNode.textContent = assessment.summary ?? 'Analysis complete.';

  explanationsList.innerHTML = '';
  (assessment.explanations ?? []).forEach((explanation) => {
    const li = document.createElement('li');
    li.textContent = explanation;
    explanationsList.appendChild(li);
  });

  if (!assessment.explanations?.length) {
    const li = document.createElement('li');
    li.textContent = 'No key findings surfaced.';
    explanationsList.appendChild(li);
  }

  if (assessment.transcriptSummary) {
    transcriptNode.textContent = assessment.transcriptSummary;
  } else {
    transcriptNode.textContent = 'No audio scanned.';
  }

  if (assessment.agentPersona) {
    agentPersonaNode.textContent = assessment.agentPersona;
  } else {
    agentPersonaNode.textContent = 'n/a';
  }

  const timestamp = new Date(assessment.generatedAt ?? Date.now()).toLocaleTimeString();
  statusNode.textContent = `Scan finished at ${timestamp}.`;
}

async function triggerAnalysis(payload, message, options) {
  if (!hasBridge) {
    return;
  }
  setLoading(true, message, options);
  try {
    const assessment = await window.scamShield.analyze(payload);
    renderAssessment(assessment);
  } catch (error) {
    statusNode.textContent = `Failed: ${error.message}`;
  } finally {
    setLoading(false);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const url = urlInput.value.trim();
  if (!url) {
    statusNode.textContent = 'Enter a URL to analyze.';
    return;
  }
  await triggerAnalysis({ url }, 'Analyzing URL...');
}

function handleDragOver(event) {
  event.preventDefault();
  dropZone?.classList.add('dragover');
}

function handleDragLeave(event) {
  event.preventDefault();
  dropZone?.classList.remove('dragover');
}

async function handleDrop(event) {
  event.preventDefault();
  dropZone?.classList.remove('dragover');

  const file = event.dataTransfer?.files?.[0];
  if (!file || !file.path) {
    statusNode.textContent = 'Drop a valid audio file.';
    return;
  }

  await triggerAnalysis({ audioFile: file.path }, 'Transcribing audio...', {
    highlightDropZone: true
  });
}

if (hasBridge) {
  window.scamShield.onAnalysisComplete((payload) => {
    const data = payload?.assessment ?? payload;
    renderAssessment(data);
  });
}

if (form) {
  form.addEventListener('submit', handleSubmit);
}

if (dropZone) {
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, handleDragOver);
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, handleDragLeave);
  });
  dropZone.addEventListener('drop', handleDrop);
}
