require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cron = require("node-cron");

const db = require("../database/db");
const redisClient = require("./clients/redisClient");

const fetchMacros = require("./macros/fetchMacros");
const filterMacros = require("./macros/filterMacros");
const saveMacros = require("./macros/saveMacros");
const matchMacros = require("./macros/matchMacros");

const exportFeedbackToCSV = require("./export/csvExporter");
const exportFeedbackToGoogleSheets = require("./export/googleSheetsExporter");
const {
  classifyAndAnalyzeText,
  getDetailedFeedback,
} = require("./qa/textAnalyzer");

const app = express();
app.use(bodyParser.json());

const fetchAndSaveMacros = async () => {
  try {
    const macros = await fetchMacros();
    const filteredMacros = filterMacros(macros);
    saveMacros(filteredMacros);
    await redisClient.set("macros", JSON.stringify(filteredMacros));
    console.log("Macros fetched and saved successfully");
  } catch (error) {
    console.error("Error fetching or saving macros:", error);
  }
};

// Schedule the task to run daily at midnight
cron.schedule("0 0 * * *", fetchAndSaveMacros);

fetchAndSaveMacros(); // Run once at startup

// Endpoint to analyze text against macros and return if a match is found
app.post("/v1/macro-comparison", async (req, res) => {
  const { text } = req.body;
  const cachedMacros = await redisClient.get("macros");

  const processMacros = (macros) => {
    for (let macro of macros) {
      for (let action of macro.actions) {
        if (action.field === "comment_value") {
          const macroValue = action.value;
          if (matchMacros(macroValue, text)) {
            return res.json({ match: true, macro });
          }
        }
      }
    }
    return res.json({ match: false });
  };

  if (!text) {
    return res.status(400).send("Text is required");
  }

  // Fetch macros from Redis cache
  if (cachedMacros) {
    const macros = JSON.parse(cachedMacros);
    return processMacros(macros);
  } else {
    db.all("SELECT * FROM macros", [], (err, rows) => {
      if (err) {
        return res.status(500).send("Error fetching macros from database");
      }

      const macros = rows.map((row) => ({
        ...row,
        actions: JSON.parse(row.actions),
      }));

      // Cache the macros in Redis
      redisClient.set("macros", JSON.stringify(macros));

      return processMacros(macros);
    });
  }
});

// Endpoint to list all macros
app.get("/v1/list-macros", async (req, res) => {
  const cachedMacros = await redisClient.get("macros");
  if (cachedMacros) {
    const macros = JSON.parse(cachedMacros);
    return res.json(macros);
  } else {
    db.all("SELECT * FROM macros", [], (err, rows) => {
      if (err) {
        return res.status(500).send("Error fetching macros from database");
      }

      const macros = rows.map((row) => ({
        ...row,
        actions: JSON.parse(row.actions),
      }));

      // Cache the macros in Redis
      redisClient.set("macros", JSON.stringify(macros));

      return res.json(macros);
    });
  }
});

// Endpoint to submit feedback about a ticket
app.post("/v1/post-feedback", (req, res) => {
  const {
    ticket_id,
    feedback_type,
    feedback_presets,
    written_feedback,
    text_editor_content,
    generation_type,
  } = req.body;

  // Validate feedback input
  if (
    typeof ticket_id !== "number" ||
    (feedback_type !== "positive" && feedback_type !== "negative") ||
    !Array.isArray(feedback_presets) ||
    (feedback_type === "negative" && !written_feedback) ||
    typeof text_editor_content !== "string" ||
    (generation_type !== "macro" && generation_type !== "ai")
  ) {
    return res.status(400).send("Invalid feedback input");
  }

  // Prepare feedback presets as a string
  const feedbackPresetsStr = feedback_presets.join(",");

  // Insert feedback into the database
  const stmt = db.prepare(
    `INSERT INTO feedback (ticket_id, feedback_type, feedback_presets, written_feedback, text_editor_content, generation_type) VALUES (?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    ticket_id,
    feedback_type,
    feedbackPresetsStr,
    written_feedback || null,
    text_editor_content,
    generation_type,
    (err) => {
      if (err) {
        return res.status(500).send("Error saving feedback");
      }

      res.send("Feedback submitted successfully");
    }
  );
  stmt.finalize();
});

// Endpoint to export feedback
app.get("/v1/export-feedback", async (req, res) => {
  const { feedback_type, generation_type, start_date, end_date, export_type } =
    req.query;

  // Validate query parameters
  if (
    (export_type && export_type !== "csv" && export_type !== "google_sheets") ||
    (feedback_type &&
      feedback_type !== "positive" &&
      feedback_type !== "negative") ||
    (generation_type &&
      generation_type !== "macro" &&
      generation_type !== "ai") ||
    (start_date && isNaN(Date.parse(start_date))) ||
    (end_date && isNaN(Date.parse(end_date)))
  ) {
    return res.status(400).send("Invalid query parameters");
  }

  const filters = { feedback_type, generation_type, start_date, end_date };

  try {
    if (export_type === "google_sheets") {
      console.log("Exporting feedback to Google Sheets");
      const spreadsheetUrl = await exportFeedbackToGoogleSheets(filters);
      res.json({
        message: "Feedback exported successfully to Google Sheets",
        url: spreadsheetUrl,
      });
    }
    if (export_type === "csv") {
      const csv = await exportFeedbackToCSV(filters);
      res.header("Content-Type", "text/csv");
      res.attachment("feedback_export.csv");
      res.send(csv);
    }
  } catch (err) {
    res.status(500).send("Error exporting feedback");
  }
});

// Endpoint to analyze text and return the category and scores
app.post("/v1/analyze-text", async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).send("Text is required");
  }

  try {
    const templates = await redisClient.get("templates");
    const parsedTemplates = JSON.parse(templates);
    const categories = Object.keys(parsedTemplates);
    const result = await classifyAndAnalyzeText(text, categories);
    res.json({
      category: result.category,
      scores: result.scores,
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Endpoint to get detailed feedback based on the provided text and category
app.post("/v1/detailed-feedback", async (req, res) => {
  const { text, category } = req.body;

  if (!text || !category) {
    return res.status(400).send("Text and category are required");
  }

  try {
    const templates = await redisClient.get("templates");
    const parsedTemplates = JSON.parse(templates);
    if (!templates[category]) {
      return res.status(400).send("Invalid category");
    }

    const template = templates[category].template;
    const feedback = await getDetailedFeedback(text, template);
    res.json({ feedback });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/v1/templates", async (req, res) => {
  const { category, template } = req.body;

  if (!category || !template) {
    return res.status(400).send("Category and template are required");
  }

  try {
    // Get existing templates from Redis
    const templates = await redisClient.get("templates");
    const parsedTemplates = JSON.parse(templates) || {};

    // Add new template
    parsedTemplates[category] = {
      category,
      template,
      scoring_criteria: {
        tone: 10,
        process: 10,
        empathy: 10,
      },
    };

    // Save updated templates to Redis
    await redisClient.set("templates", JSON.stringify(parsedTemplates));

    // Save new template to database
    const stmt = db.prepare(
      `INSERT INTO templates (category, template, scoring_criteria) VALUES (?, ?, ?)`
    );
    stmt.run(
      category,
      template,
      JSON.stringify(parsedTemplates[category].scoring_criteria),
      (err) => {
        if (err) {
          return res.status(500).send("Error saving template to database");
        }
        res.send("Template submitted successfully");
      }
    );
    stmt.finalize();
  } catch (error) {
    res.status(500).send("Error submitting template");
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
