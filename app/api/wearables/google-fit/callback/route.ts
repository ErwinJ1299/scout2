import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const userId = searchParams.get('state');

  console.log('🔍 Google Fit callback received:', { code: code?.substring(0, 10), userId });

  if (!code || !userId) {
    console.error('❌ Missing code or userId');
    return NextResponse.redirect(new URL('/patient/wearables?error=missing_code', request.url));
  }

  try {
    console.log('🔄 Exchanging Google Fit auth code for tokens...');
    
    // Exchange auth code for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/wearables/google-fit/callback`,
        grant_type: 'authorization_code'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || data.error || 'Failed to exchange code');
    }

    console.log('✅ Token exchange successful');

    // Encode tokens in URL to pass to client-side for saving
    const params = new URLSearchParams({
      success: 'google_fit_connected',
      userId,
      deviceType: 'google_fit',
      accessToken: data.access_token,
      refreshToken: data.refresh_token || ''
    });

    return NextResponse.redirect(new URL(`/patient/wearables?${params.toString()}`, request.url));
  } catch (error: any) {
    console.error('❌ Google Fit callback error:', error);
    return NextResponse.redirect(new URL('/patient/wearables?error=connection_failed&message=' + encodeURIComponent(error.message), request.url));
  }
}
