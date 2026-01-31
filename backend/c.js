// list_models.js
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables if using a .env file

const API_KEY = process.env.GOOGLE_API_KEY;

async function listAllModels() {
  if (!API_KEY) {
    console.error("Error: GOOGLE_API_KEY is missing.");
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

  try {
    console.log("Fetching model list...");
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log("\n--- AVAILABLE MODELS (v1beta) ---");
    if (data.models && data.models.length > 0) {
      // Filter for "generateContent" support to see chat-capable models
      const chatModels = data.models.filter(m =>
        m.supportedGenerationMethods.includes("generateContent")
      );

      chatModels.forEach((model) => {
        console.log(`- ${model.name.replace('models/', '')}`);
        // Optional: Print display name or version
        // console.log(`  Description: ${model.displayName}`); 
      });

      console.log(`\n(Total: ${chatModels.length} content generation models found)`);
    } else {
      console.log("No models returned.");
    }
    console.log("-----------------------------------\n");

  } catch (error) {
    console.error("Listing failed:", error.message);
  }
}

listAllModels();