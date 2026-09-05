// this expects RoValra to be cloned in the RoValra folder
// also run this is a linux environment

import path from "path"
import fs from "fs/promises"
import {exec} from "child_process"
import https from "https"

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
manifestFile.host_permissions.push("https://*.rovalra.com/*")
manifestFile.declarative_net_request.rule_resources.push({
    "id": "cors_fix",
    "enabled": true,
    "path": "public/Assets/Rules/cors.json"
})
manifestFile.web_accessible_resources[0].resources.push("public/fonts/*")

await fs.writeFile(manifestPath, JSON.stringify(manifestFile))



const apiJsPath = path.join(roValraPath, "src", "content", "core", "api.js")
let apiJs = await fs.readFile(apiJsPath, "utf-8")
apiJs = apiJs.replace(
    `lastResponse = await fetch(fullUrl, fetchOptions);`,
    `lastResponse = await new Promise((resolve) => {
        const serializedHeaders = {};
        normalizedHeaders.forEach((val, key) => { serializedHeaders[key] = val; });
        browser.runtime.sendMessage(
            {
                action: 'fetchRovalraApi',
                url: fullUrl,
                options: {
                    method: fetchOptions.method,
                    headers: serializedHeaders,
                    body: fetchOptions.body ?? null,
                    credentials: fetchOptions.credentials,
                    cache: fetchOptions.cache,
                }
            },
            (response) => {
                if (browser.runtime.lastError || !response) { resolve(Response.error()); return; }
                const { body, ...init } = response;
                resolve(new Response(body, init));
            }
        );
    });`
)
await fs.writeFile(apiJsPath, apiJs)

const bgPath = path.join(roValraPath, "src", "background", "background.js")
const bgListener = `
        case 'fetchRovalraApi':
            fetch(request.url, request.options || {})
                .then(async (res) => {
                    const body = await res.text();
                    sendResponse({ body, status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()) });
                })
                .catch((err) => sendResponse({ body: '', status: 0, statusText: err.message }));
            return true;
`
let bg = await fs.readFile(bgPath, "utf-8")
bg = bg.replace(
    `case 'fetchJson':`,
    bgListener + `\n        case 'fetchJson':`
)
await fs.writeFile(bgPath, bg)

const corsRule = JSON.stringify([
    {
        "id": 1,
        "priority": 1,
        "action": {
            "type": "modifyHeaders",
            "responseHeaders": [
                { "header": "Access-Control-Allow-Origin", "operation": "set", "value": "*" },
                { "header": "Access-Control-Allow-Methods", "operation": "set", "value": "GET, POST, OPTIONS" },
                { "header": "Access-Control-Allow-Headers", "operation": "set", "value": "*" }
            ]
        },
        "condition": {
            "urlFilter": "apis.rovalra.com",
            "resourceTypes": ["xmlhttprequest"]
        }
    }
], null, 2)
await fs.writeFile(path.join(roValraPath, "public", "Assets", "Rules", "cors.json"), corsRule)

const fonts = [
    "BuilderIcons-Regular.woff2",
    "BuilderIcons-Regular.ttf",
    "BuilderIcons-Filled.woff2",
    "BuilderIcons-Filled.ttf",
    "RoValraIcons.woff2",
    "RoValraIcons.ttf",
]

const fontsDir = path.join(roValraPath, "public", "fonts")
await fs.mkdir(fontsDir, { recursive: true })

await Promise.all(fonts.map(font => new Promise<void>((resolve, reject) => {
    https.get(`https://www.rovalra.com/static/fonts/${font}`, res => {
        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => chunks.push(chunk))
        res.on("end", () => fs.writeFile(path.join(fontsDir, font), Buffer.concat(chunks)).then(resolve).catch(reject))
        res.on("error", reject)
    }).on("error", reject)
})))

const scssPath = path.join(roValraPath, "src", "css", "components", "builder_icons.scss")
let scss = await fs.readFile(scssPath, "utf-8")
scss = scss.replaceAll(
    `url('https://www.rovalra.com/static/fonts/`,
    `url('../public/fonts/`
)
await fs.writeFile(scssPath, scss)
