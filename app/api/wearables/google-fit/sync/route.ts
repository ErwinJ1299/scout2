import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 400 });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTimeMillis = startOfDay.getTime();
    const endTimeMillis = now.getTime();
    const metrics: any[] = [];

    // Fetch aggregated data
    try {
      const response = await fetch(
        'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            aggregateBy: [
              { dataTypeName: 'com.google.step_count.delta' },
              { dataTypeName: 'com.google.heart_rate.bpm' },
              { dataTypeName: 'com.google.calories.expended' }
            ],
            startTimeMillis,
            endTimeMillis
          })
        }
      );

      const data = await response.json();

      if (data.bucket) {
        for (const bucket of data.bucket) {
          for (const dataset of bucket.dataset) {
            for (const point of dataset.point) {
              const dataTypeName = dataset.dataTypeName;
              
              if (dataTypeName.includes('step_count') && point.value[0]?.intVal) {
                metrics.push({
                  metricType: 'steps',
                  value: point.value[0].intVal,
                  unit: 'steps',
                  source: 'google_fit'
                });
              } else if (dataTypeName.includes('heart_rate') && point.value[0]?.fpVal) {
                metrics.push({
                  metricType: 'heart_rate',
                  value: Math.round(point.value[0].fpVal),
                  unit: 'bpm',
                  source: 'google_fit'
                });
              } else if (dataTypeName.includes('calories') && point.value[0]?.fpVal) {
                metrics.push({
                  metricType: 'calories',
                  value: Math.round(point.value[0].fpVal),
                  unit: 'kcal',
                  source: 'google_fit'
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching Google Fit data:', error);
    }

    return NextResponse.json({ 
      success: true, 
      metrics,
      metricsCount: metrics.length 
    });

  } catch (error: any) {
    console.error('Google Fit sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync Google Fit data' }, 
      { status: 500 }
    );
  }
}
