/**
 * Copilot SDK - Programmatic GitHub Device Flow OAuth
 * 
 * This script implements the GitHub Device Flow directly,
 * then uses the obtained token with CopilotClient.
 * 
 * Flow:
 * 1. POST /login/device/code → get device_code, user_code, verification_uri
 * 2. Display URL + code to user
 * 3. Poll /login/oauth/access_token until user completes auth
 * 4. Use token with CopilotClient to make a test request
 */

const CLIENT_ID = 'Ov23ctDVkRmgkPke0Mmm';
const BASE_URL = 'https://github.com';
const SCOPES = 'read:user,read:org,repo,gist';

async function requestDeviceCode() {
  const url = `${BASE_URL}/login/device/code`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to request device code: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function pollForAccessToken(deviceCode, interval) {
  const url = `${BASE_URL}/login/oauth/access_token`;
  let pollInterval = interval * 1000; // convert to ms

  while (true) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.access_token) {
      console.log('✅ Access token received!');
      return data.access_token;
    }

    if (data.error === 'authorization_pending') {
      process.stdout.write('.');
      continue;
    }

    if (data.error === 'slow_down') {
      pollInterval = (data.interval || (pollInterval / 1000) + 5) * 1000;
      process.stdout.write('s');
      continue;
    }

    if (data.error === 'expired_token') {
      throw new Error('Device code expired. Please restart the auth flow.');
    }

    throw new Error(data.error_description || `Unexpected error: ${data.error}`);
  }
}

async function testCopilotSDK(token) {
  console.log('\n🔧 Testing Copilot SDK with obtained token...');

  const { CopilotClient } = await import('@github/copilot-sdk');
  const client = new CopilotClient({
    githubToken: token,
  });

  try {
    await client.start();
    console.log('✅ CopilotClient started successfully');

    const authStatus = await client.getAuthStatus();
    console.log('📋 Auth status:', JSON.stringify(authStatus, null, 2));

    if (!authStatus.isAuthenticated) {
      console.log('❌ Not authenticated despite providing token');
      return;
    }

    // Create a session and make a test request
    const session = await client.createSession({
      agentName: 'auth-test',
      systemMessage: 'You are a test assistant. Reply briefly.',
      model: 'gpt-4o-mini', // free model
    });

    console.log('📝 Session created, sending test message...');

    // Collect response via event handler
    let responseText = '';
    session.on('session.event', (event) => {
      if (event.type === 'content.delta' && event.delta?.text) {
        responseText += event.delta.text;
      }
    });

    const result = await session.sendAndWait('Say hello in one word.');
    // Also try to extract from result
    if (result?.content) {
      for (const block of Array.isArray(result.content) ? result.content : [result.content]) {
        if (typeof block === 'string') responseText += block;
        else if (block?.text) responseText += block.text;
      }
    }

    console.log('🤖 Model response:', responseText || JSON.stringify(result));
    console.log('✅ Full flow completed successfully!');

    await session.destroy();
    await client.stop();
  } catch (error) {
    console.error('❌ SDK error:', error.message);
    try { await client.stop(); } catch {}
  }
}

async function main() {
  console.log('🔑 Copilot SDK - GitHub Device Flow OAuth\n');

  // Step 1: Request device code
  console.log('Step 1: Requesting device code...');
  const deviceInfo = await requestDeviceCode();

  console.log('\n' + '='.repeat(60));
  console.log('📋 AUTHORIZATION REQUIRED');
  console.log('='.repeat(60));
  console.log(`\n1. Open this URL in your browser:\n   ${deviceInfo.verification_uri}`);
  console.log(`\n2. Enter this code:\n   ${deviceInfo.user_code}`);
  console.log(`\nCode expires in ${deviceInfo.expires_in} seconds`);
  console.log('='.repeat(60));

  // Step 2: Poll for token
  console.log('\nWaiting for authorization');
  const token = await pollForAccessToken(deviceInfo.device_code, deviceInfo.interval);

  // Step 3: Verify user
  console.log('\n📋 Verifying user...');
  const userResponse = await fetch(`${BASE_URL.replace('github.com', 'api.github.com')}/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });
  // GitHub API is at api.github.com
  const userResponse2 = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });
  if (userResponse2.ok) {
    const user = await userResponse2.json();
    console.log(`✅ Authenticated as: ${user.login}`);
  }

  // Step 4: Test with SDK
  await testCopilotSDK(token);

  // Output token for reference
  console.log('\n📝 Token (first 10 chars):', token.substring(0, 10) + '...');
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
