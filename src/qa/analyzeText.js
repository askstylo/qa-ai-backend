const openai = require("../openaiClient");
const templates = require("./templates.json"); // Load templates

/**
 * Classify the text and analyze it based on the corresponding template.
 * @param {string} text - The text to be analyzed.
 * @returns {Promise<Object>} - The classification and analysis results.
 */
async function classifyAndAnalyzeText(text) {
  try {
    // Step 1: Classify the text into one of the categories\

    const classificationResponse = await openai.chat.completions.create({
      model: "gpt-4-0613",
      messages: [
        {
          role: "system",
          content:
            "Classify the following text into one of these categories: refund, support. If you can't determine the category, return 'false'.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      functions: [
        {
          name: "classify_text",
          description: "Classify the text into a category",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: [
                  "refund",
                  "order_delay",
                  "product_inquiry",
                  "support",
                  "feedback_request",
                  "shipping_issue",
                  "false",
                ],
              },
            },
            required: ["category"],
          },
        },
      ],
      function_call: { name: "classify_text" },
    });

    const classificationResult =
      classificationResponse.choices[0].message.function_call;

    console.log("Classification Result:", classificationResult);

    parsedArguments = JSON.parse(classificationResult.arguments);

    if (
      classificationResult.name === "classify_text" &&
      parsedArguments.category !== "false"
    ) {
      const category = parsedArguments.category;

      if (!templates[category]) {
        throw new Error("Template for classified category not found");
      }

      const template = templates[category].template;

      // Step 2: Analyze the text against the template
      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-4-0613",
        messages: [
          {
            role: "system",
            content: `Analyze the following text based on the template: "${template}". Provide a score in 3 categories: Tone, Process, Empathy. Each category has a max score of 10.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
      });

      const analysisResult = analysisResponse.choices[0].message.content;

      return {
        category: category,
        analysis: analysisResult,
      };
    } else {
      return { match: false };
    }
  } catch (error) {
    console.error("Error analyzing text with OpenAI:", error);
    throw new Error("Error analyzing text with OpenAI");
  }
}

module.exports = classifyAndAnalyzeText;
