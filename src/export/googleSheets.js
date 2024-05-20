const { google } = require("googleapis");
const db = require("../../database/db");
const { GoogleAuth } = require("google-auth-library");

const serviceAccountKeyBase64 = process.env.GOOGLE_SERVICE_ACCT_KEY;
const credentials = JSON.parse(
  Buffer.from(serviceAccountKeyBase64, "base64").toString("utf8")
);

/**
 * Export feedback based on the provided filters to Google Sheets
 * @param {object} filters - The filters to apply (feedback_type, generation_type, start_date, end_date)
 * @param {string} spreadsheetId - The ID of the Google Sheets document
 * @param {string} range - The range in the sheet where the data should be written
 * @returns {Promise<void>}
 */
async function exportFeedbackToGoogleSheets(filters, range) {
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
      const feedbackData = rows.map((row) => [
        row.ticket_id,
        row.feedback_type,
        row.feedback_presets,
        row.written_feedback,
        row.text_editor_content,
        row.generation_type,
        row.created_at,
      ]);

      try {
        // Authorize and connect to Google Sheets API
        const auth = new GoogleAuth({
          credentials,
          scopes: [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
          ],
        });

        const sheets = google.sheets({ version: "v4", auth });
        const drive = google.drive({ version: "v3", auth });

        const createResponse = await sheets.spreadsheets.create({
          resource: {
            properties: {
              title: "Feedback Export",
            },
            sheets: [
              {
                properties: {
                  title: "Feedback",
                },
              },
            ],
          },
        });

        const spreadsheetId = createResponse.data.spreadsheetId;

        // Write data to Google Sheets
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: range || "Feedback!A1",
          valueInputOption: "RAW",
          resource: {
            values: [
              [
                "Ticket ID",
                "Feedback Type",
                "Feedback Presets",
                "Written Feedback",
                "Text Editor Content",
                "Generation Type",
                "Created At",
              ],
              ...feedbackData,
            ],
          },
        });

        // Make the spreadsheet public
        await drive.permissions.create({
          fileId: spreadsheetId,
          requestBody: {
            role: "writer",
            type: "anyone",
          },
        });

        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
        resolve(spreadsheetUrl);
      } catch (error) {
        console.error("Error exporting feedback to Google Sheets:", error);
        reject(error);
      }
    });
  });
}

module.exports = exportFeedbackToGoogleSheets;
