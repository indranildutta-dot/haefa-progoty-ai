import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const categories = [
  "Infectious and parasitic diseases (e.g., Dengue, Malaria, Typhoid, TB, Gastroenteritis, Cholera, Hepatitis)",
  "Non-communicable diseases (e.g., Hypertension, Diabetes, Asthma, COPD, Ischemic heart disease, Stroke)",
  "Maternal, neonatal, and nutritional disorders (e.g., Anemia, Malnutrition, Pregnancy complications, Vitamin def)",
  "Injuries, poisonings, and environmental causes (e.g., Snake bites, road accidents, burns, pesticide poisoning)",
  "Mental health, dermatology, musculoskeletal and general ailments (e.g., Depression, Scabies, Eczema, Osteoarthritis, Headaches)"
];

async function generate() {
  let allCodes = [];
  
  for (let i = 0; i < categories.length; i++) {
    console.log(`Generating category ${i+1}/${categories.length}: ${categories[i]}...`);
    const prompt = `Generate exactly 150 of the most common ICD-11 codes related to "${categories[i]}" typically seen in primary care in South Asia. 
Respond ONLY with a valid JSON array of objects. Do not include markdown blocks like \`\`\`json.
Each object MUST have:
- "code": The ICD-11 code (e.g., "1F41.0")
- "name": The formal formal name of the disease/condition
- "keywords": An array of 3 to 4 layman search keywords (e.g., ["dengue fever", "mosquito bite", "high fever", "bone pain"])

Ensure exactly 150 unique codes are provided in the JSON array. Output nothing besides the JSON array.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
      }
    });

    try {
      let text = response.text;
      text = text.replace(/^```json/, '').replace(/```$/, '').trim();
      const items = JSON.parse(text);
      allCodes = allCodes.concat(items);
      console.log(`Got ${items.length} items for category ${i+1}. Total: ${allCodes.length}`);
    } catch (e) {
      console.error(`Failed to parse category ${i+1}:`, e.message);
      console.log("Raw response (first 200 chars):", response.text.substring(0, 200));
    }
  }

  // Deduplicate just in case
  const unique = [];
  const seen = new Set();
  for (const item of allCodes) {
    if (!seen.has(item.code)) {
      seen.add(item.code);
      unique.push(item);
    }
  }

  console.log(`Successfully generated ${unique.length} unique codes. Saving to web/src/data/icd11_south_asia.json`);
  if (!fs.existsSync('web/src/data')) {
    fs.mkdirSync('web/src/data', { recursive: true });
  }
  fs.writeFileSync('web/src/data/icd11_south_asia.json', JSON.stringify(unique, null, 2));
}

generate().catch(console.error);
