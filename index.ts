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

await fs.writeFile(manifestPath, JSON.stringify(manifestFile))