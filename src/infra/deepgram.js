// Mock Deepgram transcription client. Replace with the official SDK when wiring the real API.

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function transcribeAudio({ filePath }) {
  if (!filePath) {
    return null;
  }

  await delay(160);

  return {
    filePath,
    transcript:
      'Urgent payment required to avoid legal consequences with the IRS. Please wire funds immediately.',
    confidence: 0.78,
    detectedLanguage: 'en-US'
  };
}

module.exports = {
  transcribeAudio
};
