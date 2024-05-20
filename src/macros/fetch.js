const axios = require('axios');
const zendeskDomain = process.env.ZENDESK_DOMAIN;
const zendeskApiToken = process.env.ZENDESK_API_TOKEN;
const zendeskEmail = process.env.ZENDESK_EMAIL;

const url = `https://${zendeskDomain}.zendesk.com/api/v2/macros/active.json`;
const auth = {
  username: `${zendeskEmail}/token`,
  password: zendeskApiToken
};
const params = { 
  "page[size]": 100,
 };

/**
 * @typedef Macro
 * @property {string} id - The unique identifier for the macro.
 * @property {string} url - The URL where the macro is to be executed.
 * @property {string} title - The title or name of the macro.
 * @property {boolean} active - A flag indicating whether the macro is active or not.
 * @property {string} updated_at - The timestamp of when the macro was last updated.
 * @property {string} created_at - The timestamp of when the macro was created.
 * @property {Object[]} actions - An array of action objects that define what the macro does.
 */

/**
 * Fetches all active macros from Zendesk.
 * @returns {Promise<Macro[]>} A promise that resolves with an array of Macro objects.
 */


const fetchMacros = async () => {
  let allMacros = [];
  let currentUrl = url;

  do {
    const response = await axios.get(currentUrl, { auth: auth, params: params });
    const data = response.data;
    // Collect macros from the current page
    allMacros = allMacros.concat(data.macros);

    // Check if there are more pages
    if (data.meta.has_more) {
      currentUrl = data.links.next;
    } else {
      currentUrl = null;
    }
  } while (currentUrl);

  return allMacros;
};

module.exports = fetchMacros;
