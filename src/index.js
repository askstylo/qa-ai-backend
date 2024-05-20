require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const db = require("../database/db");
const redisClient = require("./redisClient");

const fetchMacros = require("./macros/fetch");
const filterMacros = require("./macros/filter");
const saveMacros = require("./macros/save");
const cron = require("node-cron");
const matchMacros = require("./macros/match");
const exportFeedbackToCSV = require("./export/csv");
const exportFeedbackToGoogleSheets = require("./export/googleSheets");

const app = express();
app.use(bodyParser.json());

const fetchAndSaveMacros = async () => {
  try {
    const macros = await fetchMacros();
    const filteredMacros = filterMacros(macros);
    saveMacros(filteredMacros);
    redisClient.set("macros", JSON.stringify(filteredMacros));
    console.log("Macros fetched and saved successfully");
  } catch (error) {
    console.error("Error fetching or saving macros:", error);
  }
};

// Schedule the task to run daily at midnight
cron.schedule("0 0 * * *", fetchAndSaveMacros);

fetchAndSaveMacros(); // Run once at startup

// Endpoint to analyze text against macros
app.post("/analyze", (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).send("Text is required");
  }

  // Fetch macros from Redis cache
  redisClient.get("macros", (err, data) => {
    if (err) {
      return res.status(500).send("Error fetching macros from cache");
    }

    if (data) {
      const macros = JSON.parse(data);

      for (let macro of macros) {
        for (let action of macro.actions) {
          if (action.field === "comment_value") {
            const macro = action.value;

            if (matchMacros(macro, text)) {
              return res.json({ match: true, macro });
            }
          }
        }
      }

      return res.json({ match: false });
    } else {
      return res.status(500).send("No macros found in cache");
    }
  });
});

app.get("/macros", (req, res) => {
  db.all("SELECT * FROM macros", [], (err, rows) => {
    if (err) {
      return res.status(500).send("Error fetching macros from database");
    }

    const macros = rows.map((row) => ({
      ...row,
      actions: JSON.parse(row.actions),
    }));

    return res.json(macros);
  });
});

// Endpoint to submit feedback
app.post("/feedback", (req, res) => {
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

app.get("/export-feedback", async (req, res) => {
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

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
