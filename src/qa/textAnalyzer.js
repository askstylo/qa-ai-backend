const openai = require("../clients/openaiClient");
const redisClient = require("../clients/redisClient");

/**
 * Classify the text and analyze it based on the corresponding template.
 * @param {string} text - The text to be analyzed.
 * @param {array} categories - The dynamic categories to classify the text.
 * @returns {Promise<Object>} - The classification and analysis results.
 */
async function classifyAndAnalyzeText(text, categories) {
  try {
    // Step 1: Classify the text into one of the categories
    const classificationResponse = await openai.chat.completions.create({
      model: "gpt-4-0613",
      messages: [
        {
          role: "system",
          content: `Classify the following text into one of these categories: ${categories.join(
            ", "
          )}. If you can't determine the category, return 'false'.`,
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
                enum: [...categories, "false"],
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


    const parsedArguments = JSON.parse(classificationResult.arguments);

    if (
      classificationResult.name === "classify_text" &&
      parsedArguments.category !== "false"
    ) {
      const category = parsedArguments.category;

      // Get the template from Redis
      const template = await redisClient.hget("templates", category);

      if (!template) {
        throw new Error("Template for classified category not found");
      }

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
        functions: [
          {
            name: "analyze_text",
            description: "Analyze the text against the template",
            parameters: {
              type: "object",
              properties: {
                tone: {
                  type: "number",
                  minimum: 0,
                  maximum: 1,
                },
                process: {
                  type: "number",
                  minimum: 0,
                  maximum: 1,
                },
                empathy: {
                  type: "number",
                  minimum: 0,
                  maximum: 1,
                },
              },
              required: ["tone", "process", "empathy"],
            },
          },
        ],
        function_call: { name: "analyze_text" },
      });

      const analysisResult =
        analysisResponse.choices[0].message.function_call;
      const scores = JSON.parse(analysisResult.arguments);
      const totalScore = scores.tone + scores.process + scores.empathy;

      return {
        category,
        scores,
        totalScore,
      };
    } else {
      return { match: false };
    }
  } catch (error) {
    console.error("Error analyzing text with OpenAI:", error);
    throw new Error("Error analyzing text with OpenAI");
  }
}

/**
 * Get detailed feedback based on the provided text and template.
 * @param {string} text - The text to be analyzed.
 * @param {string} template - The template to compare against.
 * @returns {Promise<string>} - The detailed feedback.
 */
async function getDetailedFeedback(text, template) {
  const feedbackResponse = await openai.chat.completions.create({
    model: "gpt-4-0613",
    messages: [
      {
        role: "system",
        content: `Provide detailed feedback on the following text based on the template: "${template}". Focus on areas of improvement for tone, process, and empathy.`,
      },
      {
        role: "user",
        content: text,
      },
    ],
  });

  return feedbackResponse.choices[0].message.content;
}

module.exports = {
  classifyAndAnalyzeText,
  getDetailedFeedback,
};
