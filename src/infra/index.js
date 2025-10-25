const { queryFetchAgent } = require('./fetchAgent');
const { inspectUrlInSandbox } = require('./sandbox');
const { transcribeAudio } = require('./deepgram');

async function analyzeInput({ url, audioFile } = {}) {
  if (!url && !audioFile) {
    throw new Error('Expected a URL, an audio file, or both.');
  }

  const tasks = [];

  const agentPromise = url ? queryFetchAgent({ url }) : null;
  const sandboxPromise = url ? inspectUrlInSandbox(url) : null;
  const transcriptPromise = audioFile ? transcribeAudio({ filePath: audioFile }) : null;

  if (agentPromise) tasks.push(agentPromise);
  if (sandboxPromise) tasks.push(sandboxPromise);
  if (transcriptPromise) tasks.push(transcriptPromise);

  await Promise.all(tasks);

  const agentFindings = agentPromise ? await agentPromise : null;
  const sandboxMetadata = sandboxPromise ? await sandboxPromise : null;
  const transcript = transcriptPromise ? await transcriptPromise : null;

  return {
    url,
    agentFindings,
    sandboxMetadata,
    transcript
  };
}

module.exports = {
  analyzeInput
};
