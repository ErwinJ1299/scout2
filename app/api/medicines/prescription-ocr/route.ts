import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createPrescriptionUpload } from "@/lib/firestore/medicineOrders";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("userId") as string | null;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = buffer.toString("base64");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY missing from env" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Use models/gemini-flash-latest (verified available in free tier)
    const modelName = "models/gemini-flash-latest";
    const model = genAI.getGenerativeModel({ model: modelName });
    
    console.log(`🤖 Using Gemini Model: ${modelName}`);
    console.log(`🔗 API Endpoint: generativelanguage.googleapis.com/v1beta/${modelName}:generateContent`);

    const prompt = `
Extract ONLY medicine names with dosages from this prescription image.
Return ONLY a JSON array like:
["Metformin 500mg", "Atorvastatin 10mg"]
If none found, return [].
`;

    // *** CRITICAL: correct v1 request format ***
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType: file.type,
              },
            },
          ],
        },
      ],
    });

    const text = (await result.response.text()).trim();

    // Try parsing JSON
    let extracted: string[] = [];

    try {
      extracted = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) extracted = JSON.parse(match[0]);
    }

    extracted = extracted.map((m) => m.trim()).filter(Boolean);

    if (extracted.length === 0) {
      return NextResponse.json(
        { error: "No medicines detected", medicines: [] },
        { status: 400 }
      );
    }

    const record = await createPrescriptionUpload({
      userId,
      extractedMedicines: extracted,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      medicines: extracted,
      prescriptionId: record.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "OCR failed" },
      { status: 500 }
    );
  }
}
