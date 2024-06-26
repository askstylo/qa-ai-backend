/**
 * Match text against a basline macro pattern with placeholders
 * @param {string} macro - The macro we are trying to match
 * @param {string} text - The text to be matched
 * @returns {boolean} - Whether the text matches the baseline pattern
 */

function matchMacros(macro, text) {
  // Replace placeholders with a regex wildcard pattern to match any value
  const placeholderPattern = /{{\s*[^}]+\s*}}/g;
  const regexPattern = macro.replace(placeholderPattern, "(.*)");

  // Create a regular expression from the modified baseline pattern
  const regex = new RegExp(`^${regexPattern.replace(/\s+/g, "\\s*")}$`, "i");

  // Remove extra whitespaces from the text to be matched
  const sanitizedText = text.replace(/\s+/g, " ").trim();

  // Test if the sanitized text matches the regex pattern
  return regex.test(sanitizedText);
}

module.exports = matchMacros;
