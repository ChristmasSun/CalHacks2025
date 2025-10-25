// ============================================================================
// TEMPORARY MOCK BACKEND FOR TESTING MVP
// ============================================================================
// This is a TEMPORARY backend server to test the Cluely frontend.
// DELETE THIS FILE and replace with your actual backend implementation.
//
// To run: node temp-backend.js
// This will start a server on http://localhost:8000
// ============================================================================

const http = require('http');

const PORT = 8000;

// Mock detection logic - randomly generates scam risks for testing
function mockDetection(base64Image) {
  // Simulate different scam scenarios randomly for testing
  // TEMPORARY: Replace with your real backend analysis
  const scenarios = [
    {
      risk: 85,
      reason: 'Detected suspicious phishing link pattern with urgency language ("Act now!", "Limited time"). Domain registered recently (< 30 days).',
      analysis: {
        signals: [
          'Domain age: 12 days (newly registered)',
          'Urgency language detected: "Act now!", "Limited time offer"',
          'Suspicious URL structure with obfuscation',
          'No HTTPS security certificate'
        ],
        recommendations: [
          'Do NOT click on any links',
          'Verify the sender through official channels',
          'Report this message as phishing',
          'Delete the message immediately'
        ]
      }
    },
    {
      risk: 72,
      reason: 'Instagram DM from unverified account claiming you won a prize. Common social engineering tactic.',
      analysis: {
        signals: [
          'Account created less than 7 days ago',
          'Profile uses stock photo (reverse image search match)',
          'No follower verification',
          'Prize/giveaway scam pattern detected'
        ],
        recommendations: [
          'Block and report this account',
          'Do NOT provide personal information',
          'Legitimate companies contact winners through official channels',
          'Enable two-factor authentication on your account'
        ]
      }
    },
    {
      risk: 45,
      reason: 'LinkedIn message with shortened URL (bit.ly). Proceed with caution - legitimate recruiters typically use direct links.',
      analysis: {
        signals: [
          'URL shortener detected (bit.ly)',
          'Cannot verify destination before clicking',
          'Sender has limited connection history',
          'Message contains generic job offer language'
        ],
        recommendations: [
          'Verify the sender\'s LinkedIn profile thoroughly',
          'Ask for company website and job posting link',
          'Research the company independently',
          'Use URL expander tool before clicking'
        ]
      }
    },
    {
      risk: 90,
      reason: 'CRITICAL: Email impersonating bank/financial institution asking for account verification. Classic phishing attempt.',
      analysis: {
        signals: [
          'Email domain does NOT match official bank domain',
          'Requests sensitive account credentials',
          'Generic greeting (no personalization)',
          'Threat of account suspension (pressure tactic)'
        ],
        recommendations: [
          'DO NOT respond or click any links',
          'Contact your bank directly using their official phone number',
          'Forward to your bank\'s fraud department',
          'Change your passwords if you clicked anything',
          'Report to FTC at reportfraud.ftc.gov'
        ]
      }
    },
    {
      risk: 65,
      reason: 'Suspicious persona detected - profile photo appears to be AI-generated or stock photo. Limited connection history.',
      analysis: {
        signals: [
          'Profile photo flagged as AI-generated (95% confidence)',
          'Account created within last 30 days',
          'Minimal post history',
          'Connection request with generic message'
        ],
        recommendations: [
          'Decline connection request',
          'Do NOT share professional information',
          'Report profile as fake to platform',
          'Review your privacy settings'
        ]
      }
    },
    {
      risk: 78,
      reason: 'Job offer with unusually high salary for minimal experience. Requests payment for "training materials" - red flag.',
      analysis: {
        signals: [
          'Salary 3x above market rate for position',
          'Requests upfront payment',
          'Company website created less than 2 months ago',
          'No verifiable employee reviews'
        ],
        recommendations: [
          'Reject this job offer immediately',
          'NEVER pay for job training or equipment',
          'Research company on BBB and Glassdoor',
          'Report to job platform and FTC'
        ]
      }
    }
  ];

  // Randomly select a scenario for testing
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

  return scenario;
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Enable CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Only accept POST requests to /detect endpoint
  if (req.method === 'POST' && req.url === '/detect') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        // Validate request has image field
        if (!data.image) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing image field' }));
          return;
        }

        console.log('📸 Received screenshot, generating mock detection...');

        // Simulate processing delay (realistic backend behavior)
        setTimeout(() => {
          const result = mockDetection(data.image);

          console.log(`🎯 Mock Result: ${result.risk}% risk - ${result.reason}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        }, 500); // 500ms delay to simulate API processing

      } catch (error) {
        console.error('Error parsing request:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });

  } else {
    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. Use POST /detect' }));
  }
});

// Start server
server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║          🚨 TEMPORARY MOCK BACKEND SERVER 🚨              ║');
  console.log('║                                                            ║');
  console.log('║  This is a TEMPORARY testing server.                      ║');
  console.log('║  DELETE this file when you have your real backend ready.  ║');
  console.log('║                                                            ║');
  console.log(`║  Server running on: http://localhost:${PORT}               ║`);
  console.log('║  Endpoint: POST /detect                                    ║');
  console.log('║                                                            ║');
  console.log('║  Now run "npm start" in another terminal to test Cluely!  ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Waiting for requests...\n');
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Stop the other process or change the port.`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down mock backend server...');
  server.close(() => {
    console.log('✅ Server closed. Goodbye!');
    process.exit(0);
  });
});
