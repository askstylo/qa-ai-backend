const { AsyncParser } = require("@json2csv/node");
const db = require("../../database/db");

/**
 * Export feedback based on the provided filters
 * @param {object} filters - The filters to apply (feedback_type, generation_type, start_date, end_date)
 * @returns {Promise<string>} - A promise that resolves to the CSV string
 */
async function exportFeedbackToCSV(filters) {
  const opts = {};
  const transformOpts = {};
  const asyncOpts = {};
  const parser = new AsyncParser(opts, asyncOpts, transformOpts);
  const { feedback_type, generation_type, start_date, end_date } = filters;

  // Construct the query with optional filters
  let query = "SELECT * FROM feedback WHERE 1=1";
  const params = [];

  if (feedback_type) {
    query += " AND feedback_type = ?";
    params.push(feedback_type);
  }

  if (generation_type) {
    query += " AND generation_type = ?";
    params.push(generation_type);
  }

  if (start_date) {
    query += " AND date(created_at) >= date(?)";
    params.push(start_date);
  }

  if (end_date) {
    query += " AND date(created_at) <= date(?)";
    params.push(end_date);
  }

  return new Promise((resolve, reject) => {
    db.all(query, params, async (err, rows) => {
      if (err) {
        return reject(err);
      }

      // Convert feedback presets to array
      const feedbackData = rows.map((row) => ({
        ...row,
        feedback_presets: row.feedback_presets.split(","),
      }));

      try {
        // Convert feedback data to CSV
        const csv = await parser.parse(feedbackData).promise();
        resolve(csv);
      } catch (error) {
        reject(error);
      }
    });
  });
}

module.exports = exportFeedbackToCSV;
