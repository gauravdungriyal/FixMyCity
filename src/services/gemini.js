import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const isGeminiConfigured = !!apiKey;

let genAI = null;
if (isGeminiConfigured) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log("Gemini AI SDK initialized");
  } catch (e) {
    console.error("Gemini initialization failed:", e);
  }
} else {
  console.warn("Gemini API key missing. Vision AI triage will run in simulation mode.");
}

export { isGeminiConfigured };

// Exact Civic Problem Categories provided by user + standard infrastructures
export const CIVIC_CATEGORIES = [
  "Cleanliness Target Unit (Dirty Spot)",
  "Garbage Dump",
  "Garbage Vehicle Not Arrived",
  "Burning of Garbage in Open Space",
  "Sweeping Not Done",
  "Dustbins Not Cleaned",
  "Open Defecation",
  "Yellow Spot (Urination)",
  "Overflow of Sewerage or Storm Water",
  "Stagnant Water on Road/Open Area",
  "Overflow of Septic Tanks",
  "Improper disposal of fecal waste/septage",
  "Open manholes or drains",
  "Unsafe manhole entry",
  "Removal of debris/construction material",
  "Removal of dead animals",
  "No electricity in Public Toilet",
  "No Water Supply in public toilet",
  "Blockage in public toilet",
  "Uncleaning public toilet",
  "Pothole or Road Damage",
  "Broken Streetlight",
  "Broken Sidewalk",
  "Fallen Tree / Obstruction",
  "Other Civic Issue"
];

const SYSTEM_PROMPT = `
You are the AI Triage core for 'FixMyCity', a hyperlocal civic problem solver app.
Your task is to analyze the uploaded image of a local infrastructure or sanitation issue, and output details in JSON format.

1. Classify the problem into EXACTLY one of these categories:
${CIVIC_CATEGORIES.map(cat => `   - "${cat}"`).join("\n")}

2. Create a clean, short, professional description of the issue shown in the image (max 20 words).
3. Determine the urgency/hazard level based on public safety:
   - "High" (immediate danger: open manholes, active sewerage overflow, fallen power lines, massive road blockage, unsafe manhole entry).
   - "Medium" (nuisance/hygiene hazard: overflowing dustbins, garbage dump, sweeping not done, stagnant water, uncleaning toilet, broken streetlight).
   - "Low" (minor aesthetic/inconvenience: broken sidewalk, yellow spot, minor dirty spot).

Return ONLY a raw JSON object matching the following template. Do not enclose the output in markdown code fence blocks like \`\`\`json. Return only the raw string:
{
  "category": "exact category string from the list",
  "description": "short descriptive text",
  "urgency": "Low" | "Medium" | "High"
}
`;

/**
 * Sends a base64 image capture to Gemini 1.5 Flash for civic classification
 * @param {string} base64Image - Canvas dataURL ("data:image/jpeg;base64,...")
 */
export const triageCivicImage = async (base64Image) => {
  // If not configured, run simulated analyzer for development fallback
  if (!isGeminiConfigured || !genAI) {
    console.log("Gemini API not configured. Simulating image analysis...");
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Pick a random category for testing
    const randomIndex = Math.floor(Math.random() * (CIVIC_CATEGORIES.length - 1));
    return {
      category: CIVIC_CATEGORIES[randomIndex],
      description: "Simulated AI: Garbage dump/street issue detected. (Provide Gemini Key in .env to enable real vision analysis).",
      urgency: Math.random() > 0.5 ? "Medium" : "High",
      isSimulated: true
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Parse base64 parts
    const mimeType = base64Image.split(',')[0].split(':')[1].split(';')[0];
    const base64Data = base64Image.split(',')[1];
    
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType
      }
    };

    const result = await model.generateContent([SYSTEM_PROMPT, imagePart]);
    const responseText = result.response.text();
    
    console.log("Raw Gemini Response:", responseText);

    // Clean JSON response (strip markdown wrappers if model ignores instruction)
    let jsonText = responseText.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }

    const triageData = JSON.parse(jsonText);
    
    // Validate returned category matches our list, fallback if model hallucinated
    if (!CIVIC_CATEGORIES.includes(triageData.category)) {
      console.warn("Gemini returned invalid category:", triageData.category);
      triageData.category = "Other Civic Issue";
    }

    return {
      ...triageData,
      isSimulated: false
    };

  } catch (error) {
    console.error("Gemini Vision AI triage error:", error);
    throw new Error("Failed to analyze image. Please fill details manually.");
  }
};
