/**
 * GitHub  https://github.com/tanaikech/ScriptHistoryApp<br>
 * Library name
 * @type {string}
 * @const {string}
 * @readonly
 */
var appName = "ScriptHistoryApp";

/**
 * ### Description
 * Run the script by giving object.
 * 
 * @param {Object} object Object for running script.
 * @returns {(ContentService.TextOutput|HtmlService.HtmlOutput|String)} ContentService.TextOutput or HtmlService.HtmlOutput or String is returned by depending the input object.
 */
function server(object = {}) {
  if (!object || typeof object != "object" || Object.keys(object).length == 0) {
    throw new Error("Please give valid object.");
  }
  // return new ScriptHistoryApp(object).main();

  const lock = LockService.getScriptLock();
  if (lock.tryLock(350000)) {
    try {
      return new ScriptHistoryApp(object).main();
    } catch ({ stack }) {
      throw new Error(stack);
    } finally {
      lock.releaseLock();
    }
  } else {
    throw new Error("Timeout");
  }
}

/**
 * ### Description
 * This is a Class ScriptHistoryApp for managing the script history using Google Apps Script.
 *
 * Author: Tanaike ( https://tanaikech.github.io/ )
 */
class ScriptHistoryApp {
  /**
   * ### Description
   * Constructor of this class.
   *
   * @return {void}
   */
  constructor(e) {
    this.obj = e;
  }

  /**
   * ### Description
   * Main method.
   *
   * @returns {(ContentService.TextOutput|HtmlService.HtmlOutput|String)} ContentService.TextOutput or HtmlService.HtmlOutput or String is returned by depending the input object.
   */
  main() {
    const e = this.obj;
    if (!e.hasOwnProperty("parameter")) {
      throw new Error("Invalid object.");
    }
    const { scriptId = null, folderId = "root", process = "getHistories", load = null, htmlOutput = null, jsonOutput = null, deleteDate = null, search = "", internal = "false" } = e.parameter;
    if (!scriptId) {
      return ContentService.createTextOutput("No script ID.");
    }
    let returnValue;
    if (process == "store") {
      returnValue = this.storeScript_({ scriptId, folderId });
    } else if (process == "getHistories" && jsonOutput == "true") {
      returnValue = this.getScriptHistoriesAsJSON_({ scriptId, folderId, search });
    } else if (process == "getHistories" && htmlOutput != "true") {
      returnValue = this.getScriptHistoriesAsHTML_pre_({ scriptId, folderId, search });
    } else if (process == "getHistories" && htmlOutput == "true") {
      returnValue = this.getScriptHistoriesAsHTML_({ scriptId, folderId, search });
    } else if (process == "loadHistory" && load) {
      returnValue = this.loadScriptHistory_({ folderId, scriptId, load });
    } else if (process == "deleteHistory" && deleteDate && deleteDate != "") {
      returnValue = this.deleteHistory_({ folderId, scriptId, deleteDate });
    }
    if (internal == "true") {
      returnValue = this.createHTMLOfScriptHistoriesAsHTML_({ scriptId, folderId, search });
    }
    return returnValue;
  }

  /**
   * ### Description
   * Store script from Google Apps Script project to a file.
   *
   * @param {Object} object Object for running script.
   * @return {ContentService.TextOutput} ContentService.TextOutput is returned.
   */
  storeScript_({ scriptId, folderId, type = true }) {
    const res = this.fetchAppsScriptAPI_({ scriptId, method: "get" });
    const resText = res.getContentText();
    if (res.getResponseCode() != 200) {
      return ContentService.createTextOutput(JSON.stringify({ error: resText }));
    }
    const { file, data } = this.getHistoryFile_({ folderId, scriptId });
    const obj2 = data == "" ? [] : JSON.parse(data);
    const date = new Date().toISOString();
    const newData = { date, data: JSON.parse(resText) };
    obj2.push(newData);
    file.setContent(JSON.stringify(obj2));
    const msg = `Save as ${date}`;
    return type ? ContentService.createTextOutput(msg) : msg;
  }

  /**
   * ### Description
   * Get script histories as JSON.
   *
   * @param {Object} object Object for running script.
   * @return {ContentService.TextOutput} ContentService.TextOutput is returned.
   */
  getScriptHistoriesAsJSON_({ scriptId, folderId, search }) {
    let { data } = this.getHistoryFile_({ folderId, scriptId });
    if (search) {
      let obj = data == "" ? [] : JSON.parse(data);
      const reg = new RegExp(search, "gi");
      obj = obj.filter(({ data }) => data.files.some(({ source }) => reg.test(source)));
      data = JSON.stringify(obj);
    }
    return ContentService.createTextOutput(data);
  }

  /**
   * ### Description
   * Get script histories as JSON.
   *
   * @param {Object} object Object for running script.
   * @return {ContentService.TextOutput} ContentService.TextOutput is returned.
   */
  getScriptHistoriesAsHTML_pre_({ scriptId, folderId, search }) {
    const url = `${ScriptApp.getService().getUrl()}?process=getHistories&htmlOutput=true&folderId=${folderId}&scriptId=${scriptId}&search=${search}`;
    const msg = { message: `Please access the URL "${url}" using your bowser.`, url };
    return ContentService.createTextOutput(JSON.stringify(msg));
  }

  /**
   * ### Description
   * Get script histories as HTML.
   *
   * @param {Object} object Object for running script.
   * @return {HtmlService.HtmlOutput} HtmlService.HtmlOutput is returned.
   */
  getScriptHistoriesAsHTML_({ scriptId, folderId, search }) {
    const html = this.createHTMLOfScriptHistoriesAsHTML_({ scriptId, folderId, search });
    const h = HtmlService.createTemplateFromFile("index");
    h.scriptId = scriptId;
    h.data = html;
    return h.evaluate();
  }

  /**
   * ### Description
   * Create HTML data for "getScriptHistoriesAsHTML_".
   *
   * @param {Object} object Object for running script.
   * @return {String} HTML as string.
   */
  createHTMLOfScriptHistoriesAsHTML_({ scriptId, folderId, search }) {
    const { data } = this.getHistoryFile_({ folderId, scriptId });
    let obj = data == "" ? [] : JSON.parse(data);
    if (search) {
      const reg = new RegExp(search, "gi");
      obj = obj.filter(({ data }) => data.files.some(({ source }) => reg.test(source)));
    }
    if (obj.length == 0) {
      return "No histories.";
    }
    const html = obj.map(({ date, data: { files } }) => {
      const temp = [
        `<input type="button" value="Back to '${date}'." onclick="main(this,'${date}','loadHistory')">`,
        `<input type="button" value="Delete this history." onclick="main(this,'${date}','deleteHistory')">`,
        `<h2 class="open_h2 btn">${date}</h2>`,
        `<div class="open_parent open">`
      ];
      files.forEach(({ name, source }) => {
        temp.push(`<h3 class="open_h3 btn">${name}</h3><textarea class="open_textarea open">${source}</textarea>`);
      });
      temp.push("</div>");
      return temp.join("");
    }).join("");
    return html;
  }

  /**
   * ### Description
   * Load script history to Google Apps Script project.
   *
   * @param {Object} object Object for running script.
   * @return {HtmlService.HtmlOutput} HtmlService.HtmlOutput is returned.
   */
  loadScriptHistory_({ folderId, scriptId, load }) {
    this.storeScript_({ scriptId, folderId, type: false });
    const { data } = this.getHistoryFile_({ folderId, scriptId });
    const obj = data == "" ? [] : JSON.parse(data);
    const script = obj.find(({ date }) => date == load);
    if (script) {
      const res = this.fetchAppsScriptAPI_({ scriptId, method: "put", payload: script.data });
      const resText = res.getContentText();
      if (res.getResponseCode() != 200) {
        return ContentService.createTextOutput(JSON.stringify({ error: resText }));
      }
      return ContentService.createTextOutput("Done.");
    }
    return ContentService.createTextOutput(`The history of "${load}" was not found.`);
  }

  /**
   * ### Description
   * Delete a history.
   *
   * @param {Object} object Object for running script.
   * @return {UrlFetchApp.HTTPResponse} UrlFetchApp.HTTPResponse is returned.
   */
  deleteHistory_({ folderId, scriptId, deleteDate }) {
    const { file, data } = this.getHistoryFile_({ folderId, scriptId });
    const obj = data == "" ? [] : JSON.parse(data);
    const newDate = obj.filter(({ date }) => date != deleteDate);
    file.setContent(JSON.stringify(newDate));
    return "Done.";
  }

  /**
   * ### Description
   * Request Google Apps Script API.
   *
   * @param {Object} object Object for running script.
   * @return {UrlFetchApp.HTTPResponse} UrlFetchApp.HTTPResponse is returned.
   */
  fetchAppsScriptAPI_({ scriptId, method, payload = null }) {
    const url = `https://script.googleapis.com/v1/projects/${scriptId}/content`;
    const options = { method, headers: { authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
    if (payload) {
      options.payload = JSON.stringify(payload);
      options.contentType = "application/json";
    }
    return UrlFetchApp.fetch(url, options);
  }

  /**
   * ### Description
   * Request Google Apps Script API.
   *
   * @param {Object} object Object for running script.
   * @return {Object} Object including file object and text data of the histories is returned.
   */
  getHistoryFile_({ folderId, scriptId }) {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName(scriptId);
    const file = files.hasNext() ? files.next() : folder.createFile(scriptId, "", MimeType.PLAIN_TEXT);
    const data = file.getBlob().getDataAsString();
    return { file, data };
  }
}
