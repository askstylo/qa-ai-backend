const db = require('../../database/db');

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
 * 
 * @param {Macro[]} macros - An array of Macro objects to be saved into the database.
 *  
 */

const saveMacros = (macros) => {
  const stmt = db.prepare(`INSERT INTO macros (id, url, title, active, updated_at, created_at, actions) VALUES (?, ?, ?, ?, ?, ?, ?)`);

  macros.forEach(macro => {
    stmt.run(macro.id, macro.url, macro.title, macro.active, macro.updated_at, macro.created_at, JSON.stringify(macro.actions));
  });

  stmt.finalize();
};

module.exports = saveMacros;
