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
 * Filter macros that contain a comment action
 * @param {Macro[]} macros - An array of Macro objects to filter
 * @returns {Macro[]} - An array of Macro objects that contain a comment action
 */

const filterMacros = (macros) => {
  return macros.filter((macro) => {
    return macro.actions.some((action) => action.field === "comment_value");
  });
};

module.exports = filterMacros;
