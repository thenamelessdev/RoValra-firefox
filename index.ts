// this expects RoValra to be cloned in the RoValra folder
// also run this is a linux environment

import path from "path"
import fs from "fs/promises"
import {exec} from "child_process"

const roValraPath = path.join(process.cwd(), "RoValra")

fs.access(roValraPath, fs.constants.F_OK).catch(() => {
    throw new Error("No RoValra in RoValra/")
})

exec(`sed -i 's/chrome\./browser\./g' ${path.join(roValraPath, "src/**/*.js")}`, (error) => {
    if (error) {
        console.error(error)
    }
})

const shim = `
const _fetch = window.fetch.bind(window);
window.fetch = async (url, options) => {
  if (typeof url === "string" && url.includes("apis.rovalra.com")) {
    return browser.runtime.sendMessage({ type: "fetch", url, options });
  }
  return _fetch(url, options);
};
`

const contentJsPath = path.join(roValraPath, "src", "content", "index.js")
const contentJs = await fs.readFile(contentJsPath, "utf-8")
await fs.writeFile(contentJsPath, shim + contentJs)

const bgListener = `
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "fetch") {
    fetch(message.url, message.options || {})
      .then(r => r.json())
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }
})
`

const bgPath = path.join(roValraPath, "src", "background", "background.js")
const bg = await fs.readFile(bgPath, "utf-8")
await fs.writeFile(bgPath, bg + bgListener)


const manifestPath = path.join(roValraPath, "manifest.json");

let manifestFile = JSON.parse(await fs.readFile(manifestPath, "utf-8"));

manifestFile.optional_permissions = manifestFile.optional_permissions.filter((p: string) => p !== "contextMenus" && p !== "menus")

manifestFile.background = {"scripts": ["background.js"]}
manifestFile.browser_specific_settings = {
    "gecko": {
        "id": "rovalra@thenamelessdev.com",
        "strict_min_version": "109.0",
        "data_collection_permissions": {
            "required": ["none"]
        }
    }
}
manifestFile.host_permissions.push("https://*.rovalra.com/*")

await fs.writeFile(manifestPath, JSON.stringify(manifestFile))