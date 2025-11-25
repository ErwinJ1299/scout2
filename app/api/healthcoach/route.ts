import { NextResponse } from "next/server";
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { userId, input, patientData, recentMessages, language = "en" } = await req.json();

    if (!userId || !input) {
      return NextResponse.json(
        { error: "Missing userId or input" },
        { status: 400 }
      );
    }

    // Fetch latest health readings and alerts
    let latestReadings: any = {};
    let healthAlerts: any[] = [];
    let riskScore: number | null = null;

    try {
      // Get latest 5 readings from Firestore
      const readingsSnapshot = await adminDb
        .collection('readings')
        .where('patientId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      if (!readingsSnapshot.empty) {
        const latest = readingsSnapshot.docs[0].data();
        latestReadings = {
          heartRate: latest.heartRate || null,
          steps: latest.steps || null,
          glucose: latest.glucose || null,
          bpSystolic: latest.bpSystolic || null,
          bpDiastolic: latest.bpDiastolic || null,
          weight: latest.weight || null,
          timestamp: latest.createdAt?.toDate() || null
        };

        // Calculate simple health scores
        const allReadings = readingsSnapshot.docs.map(d => d.data());
        const avgGlucose = allReadings.filter(r => r.glucose).reduce((sum, r) => sum + r.glucose, 0) / allReadings.filter(r => r.glucose).length;
        const avgBP = allReadings.filter(r => r.bpSystolic).reduce((sum, r) => sum + r.bpSystolic, 0) / allReadings.filter(r => r.bpSystolic).length;
        
        // Generate quick alerts
        if (latest.glucose > 180) {
          healthAlerts.push({ level: 'critical', message: 'High blood sugar detected', metric: 'glucose', value: latest.glucose });
        }
        if (latest.bpSystolic > 140) {
          healthAlerts.push({ level: 'warning', message: 'Elevated blood pressure', metric: 'bp', value: latest.bpSystolic });
        }
        if (latest.steps && latest.steps < 3000) {
          healthAlerts.push({ level: 'info', message: 'Low activity level today', metric: 'steps', value: latest.steps });
        }

        // Simple risk calculation
        let risk = 0;
        if (avgGlucose > 140) risk += 0.25;
        if (avgBP > 140) risk += 0.25;
        if (latest.steps < 5000) risk += 0.15;
        riskScore = Math.min(risk, 1.0);
      }
    } catch (error) {
      console.log('Could not fetch health data:', error);
    }

    // Use patient data and chat history sent from the frontend
    const patient = patientData || null;
    const recentChats = recentMessages || [];
    
    // Language names for prompt
    const languageNames: { [key: string]: string } = {
      "en": "English",
      "hi": "Hindi (हिंदी)",
      "mr": "Marathi (मराठी)"
    };

    // Build conversational context for AI
    const conversationHistory = recentChats
      .map((c: any) => `${c.role === "user" ? "Patient" : "Coach"}: ${c.text}`)
      .join("\n");

    // Create a rich context prompt for the AI
    const systemPrompt = `You are HealthSync Coach, a specialized AI health and wellness coach ONLY. You help patients with health, fitness, nutrition, mental wellness, and medical data tracking.

**CRITICAL: You are a HEALTH COACH ONLY. You MUST REFUSE to answer questions about:**
- Mathematics, calculations, or academic questions
- General knowledge, trivia, or facts unrelated to health
- Technology, programming, or non-health topics
- Entertainment, sports (unless related to fitness), or hobbies
- Any topic NOT related to health, wellness, fitness, nutrition, or medical tracking

**If asked non-health questions, respond ONLY with:**
"I'm your health coach and can only help with questions about your health, fitness, nutrition, wellness, and medical data. Please ask me something related to your health journey!"

**IMPORTANT: The patient has selected ${languageNames[language]} as their preferred language. You MUST respond in ${languageNames[language]} language ONLY.**

**PATIENT PROFILE:**
- Name: ${patient?.name || "Patient"}
- Email: ${patient?.email || "Not provided"}

**REAL-TIME HEALTH DATA (Latest Readings):**
- Heart Rate: ${latestReadings.heartRate ? `${latestReadings.heartRate} bpm` : "Not recorded"}
- Blood Glucose: ${latestReadings.glucose ? `${latestReadings.glucose} mg/dL` : "Not recorded"}
- Blood Pressure: ${latestReadings.bpSystolic ? `${latestReadings.bpSystolic}/${latestReadings.bpDiastolic || '?'} mmHg` : "Not recorded"}
- Daily Steps: ${latestReadings.steps ? `${latestReadings.steps} steps` : "Not recorded"}
- Weight: ${latestReadings.weight ? `${latestReadings.weight} kg` : "Not recorded"}
- Last Reading: ${latestReadings.timestamp ? new Date(latestReadings.timestamp).toLocaleDateString() : "Never"}

**HEALTH RISK ASSESSMENT:**
${riskScore !== null ? `- Current Risk Score: ${(riskScore * 100).toFixed(0)}% (${riskScore < 0.3 ? 'Low' : riskScore < 0.6 ? 'Moderate' : 'High'})` : '- Risk assessment unavailable'}

**ACTIVE HEALTH ALERTS:**
${healthAlerts.length > 0 ? healthAlerts.map(a => `- [${a.level.toUpperCase()}] ${a.message} (${a.metric}: ${a.value})`).join('\n') : '- No active alerts'}

**CONVERSATION CONTEXT:**
${conversationHistory || "This is the start of a new conversation."}

**YOUR ROLE & GUIDELINES (HEALTH TOPICS ONLY):**
1. **Stay on topic** - ONLY answer health/wellness/fitness/nutrition questions. Refuse everything else politely.
2. **Language** - You MUST respond ONLY in ${languageNames[language]}. This is critical.
3. **Be conversational & empathetic** - You're a coach, not a doctor. Be warm, supportive, and motivating.
4. **Safety first** - NEVER diagnose or prescribe. If readings seem concerning, suggest: "I recommend consulting your doctor about this."
5. **Personalize responses** - Use their data and history to give relevant, actionable advice.
6. **Keep it concise** - Aim for 50-100 words unless they ask for detailed guidance.
7. **Encourage healthy habits** - Focus on lifestyle, motivation, consistency, and small wins.
8. **Celebrate progress** - Acknowledge their streaks, improvements, and efforts.

**HEALTH TOPICS YOU CAN HELP WITH:**
- Blood pressure, glucose, and vital signs
- Exercise, fitness routines, and activity levels
- Nutrition, diet plans, and healthy eating
- Mental wellness, stress management, and sleep
- Weight management and healthy habits
- Medication reminders and health tracking
- General wellness and lifestyle coaching

**WHAT TO AVOID:**
- Answering ANY non-health questions (math, general knowledge, etc.)
- Medical diagnoses or treatment plans
- Prescribing medications or supplements
- Making definitive clinical statements
- Being overly clinical or robotic
- Ignoring concerning data without suggesting doctor consultation
- Responding in any language other than ${languageNames[language]}

**CURRENT PATIENT MESSAGE:**
"${input}"

Now respond naturally as their supportive health coach in ${languageNames[language]}. If the question is NOT about health/wellness/fitness/nutrition, politely refuse and redirect to health topics:`

    // Call Google Gemini API using direct REST API (v1beta for free tier)
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: systemPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = responseText;
      }
      console.error("Gemini API error:", response.status, errorData);
      
      // Handle rate limit error specifically
      if (response.status === 429) {
        throw new Error("API rate limit reached. Please wait a moment and try again.");
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Gemini API response:", JSON.stringify(data, null, 2));
    
    // Try multiple possible response structures
    const reply = 
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      data.candidates?.[0]?.content?.text ||
      data.candidates?.[0]?.text ||
      data.text ||
      "I'm here to help! Could you share more details?";
    console.log("Extracted reply:", reply);

    return NextResponse.json({ 
      reply,
      success: true 
    });

  } catch (error: any) {
    console.error("Error in health coach API:", error);
    
    // Handle specific error types
    if (error?.message?.includes("API key")) {
      return NextResponse.json(
        { error: "Gemini API key not configured. Please add GEMINI_API_KEY to .env.local" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { 
        error: "Failed to generate response",
        details: error?.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}

// ==================== ALTERNATIVE AI PROVIDERS ====================

// OPTION 1: OpenAI GPT-4o (Paid, High Quality)
// npm install openai
/*
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: input },
  ],
  temperature: 0.7,
  max_tokens: 300,
});
const reply = completion.choices[0].message.content;
*/

// OPTION 2: Claude AI (Anthropic, Paid, High Quality)
// npm install @anthropic-ai/sdk
/*
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const message = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 300,
  messages: [{ role: "user", content: systemPrompt }],
});
const reply = message.content[0].text;
*/

