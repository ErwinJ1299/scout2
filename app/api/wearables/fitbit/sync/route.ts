import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, days = 1 } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 400 });
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const period = days === 1 ? '1d' : `${days}d`;
    const metrics: any[] = [];

    // Fetch heart rate (time series for multiple days)
    try {
      const heartRateResponse = await fetch(
        `https://api.fitbit.com/1/user/-/activities/heart/date/${startDateStr}/${period}.json`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      const heartRateData = await heartRateResponse.json();

      if (heartRateData['activities-heart']) {
        heartRateData['activities-heart'].forEach((day: any) => {
          if (day.value?.restingHeartRate) {
            metrics.push({
              metricType: 'heart_rate',
              value: day.value.restingHeartRate,
              unit: 'bpm',
              source: 'fitbit',
              date: day.dateTime
            });
          }
        });
      }
    } catch (error) {
      console.error('Error fetching heart rate:', error);
    }

    // Fetch steps and calories (time series)
    try {
      const stepsResponse = await fetch(
        `https://api.fitbit.com/1/user/-/activities/steps/date/${startDateStr}/${period}.json`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      const stepsData = await stepsResponse.json();

      if (stepsData['activities-steps']) {
        stepsData['activities-steps'].forEach((day: any) => {
          if (day.value && parseInt(day.value) > 0) {
            metrics.push({
              metricType: 'steps',
              value: parseInt(day.value),
              unit: 'steps',
              source: 'fitbit',
              date: day.dateTime
            });
          }
        });
      }
    } catch (error) {
      console.error('Error fetching steps:', error);
    }

    // Fetch calories
    try {
      const caloriesResponse = await fetch(
        `https://api.fitbit.com/1/user/-/activities/calories/date/${startDateStr}/${period}.json`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      const caloriesData = await caloriesResponse.json();

      if (caloriesData['activities-calories']) {
        caloriesData['activities-calories'].forEach((day: any) => {
          if (day.value && parseInt(day.value) > 0) {
            metrics.push({
              metricType: 'calories',
              value: parseInt(day.value),
              unit: 'kcal',
              source: 'fitbit',
              date: day.dateTime
            });
          }
        });
      }
    } catch (error) {
      console.error('Error fetching calories:', error);
    }

    // Fetch sleep data for date range
    try {
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const sleepResponse = await fetch(
          `https://api.fitbit.com/1.2/user/-/sleep/date/${dateStr}.json`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );
        const sleepData = await sleepResponse.json();

        if (sleepData.summary?.totalMinutesAsleep) {
          metrics.push({
            metricType: 'sleep',
            value: sleepData.summary.totalMinutesAsleep / 60,
            unit: 'hours',
            source: 'fitbit',
            date: dateStr
          });
        }
      }
    } catch (error) {
      console.error('Error fetching sleep data:', error);
    }

    return NextResponse.json({ 
      success: true, 
      metrics,
      metricsCount: metrics.length,
      dateRange: { start: startDateStr, end: todayStr }
    });

  } catch (error: any) {
    console.error('Fitbit sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync Fitbit data' }, 
      { status: 500 }
    );
  }
}
