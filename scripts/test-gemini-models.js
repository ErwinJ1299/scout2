const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// Read .env.local file
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const apiKeyMatch = envContent.match(/GEMINI_API_KEY=(.+)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : null;

async function listModels() {
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not found in .env.local");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    console.log("🔍 Fetching available models...\n");
    
    const models = await genAI.listModels();
    
    console.log("✅ Available Models:\n");
    for (const model of models) {
      console.log(`📦 ${model.name}`);
      console.log(`   Display Name: ${model.displayName}`);
      console.log(`   Supports: ${model.supportedGenerationMethods.join(", ")}`);
      console.log("");
    }
    
    // Try to find vision-capable models
    console.log("\n🎨 Vision-capable models:");
    const visionModels = models.filter(m => 
      m.supportedGenerationMethods.includes("generateContent") &&
      (m.name.includes("vision") || m.name.includes("1.5"))
    );
    
    visionModels.forEach(m => {
      console.log(`✓ ${m.name}`);
    });
    
  } catch (error) {
    console.error("❌ Error listing models:", error.message);
  }
}

listModels();
