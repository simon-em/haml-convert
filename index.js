#!/usr/bin/env node

import { GoogleGenAI } from "@google/genai";
import path from "path";
import fs from "fs/promises";

// 1. CONFIGURATION
// Replace with your actual API Key or set GOOGLE_API_KEY in a .env file
const API_KEY = process.env.GOOGLE_API_KEY;
const FORMAT = process.env.FORMAT || "haml";
const MODEL_NAME = "gemini-3-pro-preview";

if (!API_KEY) {
  console.error(
    "❌ Error: Please set your GOOGLE_API_KEY in a .env file or directly in the script."
  );
  process.exit(1);
}

const config = {
  thinkingConfig: {
    thinkingLevel: "LOW",
  },
};

const ai = new GoogleGenAI({ apiKey: API_KEY });
//const model = genAI.getGenerativeModel({ model: MODEL_NAME });

async function convertFile(filePath) {
  try {
    console.log(`\n🔄 Processing: ${filePath}`);

    // Read HAML content
    const hamlContent = await fs.readFile(filePath, "utf-8");
    if (!hamlContent.trim()) {
      console.log("⚠️  Skipping empty file.");
      return;
    }

    // 2. CALL GEMINI API
    const prompt = `
      You are an expert Ruby on Rails developer. 
      Convert the following ${FORMAT.toUpperCase()} code to valid ERB (Embedded Ruby). 
      Do not include any markdown formatting, backticks, or explanation. 
      Return ONLY the raw ERB code.
      
      ${FORMAT.toUpperCase()} Code:
      ${hamlContent}
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: config,
    });

    //const result = await model.generateContent(prompt);

    //const response = await result.response;
    let erbContent = response.text;

    // Cleanup: Remove markdown code blocks if the AI adds them
    erbContent = erbContent
      .replace(/^```html\.erb/gm, "")
      .replace(/^```erb/gm, "")
      .replace(/^```/gm, "")
      .trim();

    // 3. WRITE NEW FILE AND REMOVE OLD ONE
    const dir = path.dirname(filePath);
    const name = path.basename(filePath, `.${FORMAT}`);
    // Rails usually expects .html.erb for views, but we keep the base logic generic
    // If the file was 'index.html.haml', this results in 'index.html.erb'
    // If it was 'header.haml', it becomes 'header.erb'
    const newExtension = name.includes(".") ? ".erb" : ".html.erb";
    const newPath = path.join(dir, `${name}${newExtension}`);

    await fs.writeFile(newPath, erbContent);
    await fs.unlink(filePath); // Delete the original .haml file

    console.log(`✅ Converted to: ${newPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to convert ${filePath}:`, error.message);

    return false;
  }
}

let totalI = 0;

async function processBatch(files, batchIndex, totalBatches) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileIndex = batchIndex * Math.ceil(files.length / totalBatches) + i;
    console.log(`[Batch ${batchIndex + 1}] Processing: ${fileIndex + 1}`);

    for (let j = 0; j < 4; j++) {
      if (j > 0) {
        console.log(`[Batch ${batchIndex + 1}] Trying again: ${j} / 3`);
      }

      if (await convertFile(file)) {
        console.log(`Processed: ${totalI++}`);
        break;
      }
    }
  }
}

async function main() {
  const files = process.argv.slice(3);

  // Find all haml files recursively
  //const files = await glob("app/views/**/*.haml");
  //const files = await glob(args[0]);

  if (files.length === 0) {
    console.log("No .haml files found in app/views.");
    return;
  }

  console.log(`Found ${files.length} files. Starting conversion...`);

  // Split files into 6 batches
  const batchSize = Math.ceil(files.length / 8);
  const batches = [];
  for (let i = 0; i < 8; i++) {
    batches.push(files.slice(i * batchSize, (i + 1) * batchSize));
  }

  // Process all batches in parallel
  await Promise.all(
    batches.map((batch, batchIndex) =>
      processBatch(batch, batchIndex, batches.length)
    )
  );

  console.log("\n🎉 All operations complete.");
}

main();
