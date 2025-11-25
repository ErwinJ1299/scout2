import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const userId = searchParams.get('state');

  console.log('🔍 Fitbit callback received:', { code: code?.substring(0, 10), userId });

  if (!code || !userId) {
    console.error('❌ Missing code or userId');
    return NextResponse.redirect(new URL('/patient/wearables?error=missing_code', request.url));
  }

  try {
    console.log('🔄 Exchanging Fitbit auth code for tokens...');
    
    // Exchange auth code for access token
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${process.env.NEXT_PUBLIC_FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`)}`
      },
      body: new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/wearables/fitbit/callback`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || data.error || 'Failed to exchange code');
    }

    console.log('✅ Token exchange successful');

    // Encode tokens in URL to pass to client-side for saving
    const params = new URLSearchParams({
      success: 'fitbit_connected',
      userId,
      deviceType: 'fitbit',
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      userId_fitbit: data.user_id || ''
    });

    return NextResponse.redirect(new URL(`/patient/wearables?${params.toString()}`, request.url));
  } catch (error: any) {
    console.error('❌ Fitbit callback error:', error);
    return NextResponse.redirect(new URL('/patient/wearables?error=connection_failed&message=' + encodeURIComponent(error.message), request.url));
  }
}
