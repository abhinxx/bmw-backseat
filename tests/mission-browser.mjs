import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import path from "node:path"
import os from "node:os"

const base = process.env.MISSION_URL ?? "http://127.0.0.1:3000"
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const profile = await mkdtemp(path.join(os.tmpdir(), "mission-browser-"))
const chrome = spawn(chromePath, ["--headless=new", "--no-first-run", "--remote-debugging-pipe", `--user-data-dir=${profile}`], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] })
let sequence = 0, buffer = "", session
const pending = new Map(), exceptions = []
chrome.stderr.on("data", () => {})
chrome.stdio[4].on("data", (chunk) => {
  buffer += chunk.toString()
  let end
  while ((end = buffer.indexOf("\0")) >= 0) {
    const text = buffer.slice(0, end); buffer = buffer.slice(end + 1)
    if (!text) continue
    const message = JSON.parse(text), waiting = pending.get(message.id)
    if (waiting) {
      pending.delete(message.id); clearTimeout(waiting.timer)
      if (message.error) waiting.reject(new Error(JSON.stringify(message.error)))
      else waiting.resolve(message.result)
    } else if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails)
  }
})
function cdp(method, params = {}, sessionId = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 45000)
    pending.set(id, { resolve, reject, timer })
    chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + "\0")
  })
}
async function evaluate(expression) {
  const response = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result.value
}
async function wait(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Condition not reached: ${expression}`)
}
async function shot(name, full = false) {
  const directory = path.resolve("research/mission-control-review")
  await mkdir(directory, { recursive: true })
  await wait("[...document.querySelectorAll('.mc-garage-art img, .mc-vehicle-image')].every(i => i.complete && i.naturalWidth > 0)")
  await wait("document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).every(a => a.playState !== 'running')")
  const viewport = await evaluate("({width:innerWidth,height:innerHeight})")
  const metrics = await cdp("Page.getLayoutMetrics")
  const result = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: full, clip: { x: 0, y: 0, width: viewport.width, height: full ? metrics.cssContentSize.height : viewport.height, scale: 1 } })
  const bytes = Buffer.from(result.data, "base64"), file = path.join(directory, `${name}.png`)
  await writeFile(file, bytes)
  console.log(`Screenshot: ${file} (${bytes.length} bytes)`)
}
try {
  await cdp("Browser.getVersion", {}, null)
  const { targetId } = await cdp("Target.createTarget", { url: "about:blank" }, null)
  session = (await cdp("Target.attachToTarget", { targetId, flatten: true }, null)).sessionId
  await cdp("Page.enable"); await cdp("Runtime.enable")
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp("Page.navigate", { url: `${base}/?v=G60&m=all` })
  await wait("document.readyState === 'complete' && !!document.querySelector('h1')")
  assert.ok(await evaluate("!!document.querySelector('[data-testid=vehicle-chooser]')"), "Mission Control needs a large visual vehicle chooser")
  assert.ok(await evaluate("document.querySelector('[data-testid=vehicle-chooser]').getBoundingClientRect().height >= 70"), "Vehicle chooser must be a prominent target")
  await wait("[...document.querySelectorAll('.mc-vehicle-image')].every(i => i.complete && i.naturalWidth > 0)")
  assert.ok(await evaluate("document.querySelector('.mc-vehicle-image').getBoundingClientRect().width > 400"), "The vehicle image must be central and large")
  assert.equal(await evaluate("document.querySelector('[data-testid=mission-view]').dataset.vehicle"), "G60")
  await shot("local-v1-desktop"); await shot("local-v1-full", true)
  await evaluate("document.querySelector('[data-testid=vehicle-chooser]').click()")
  await wait("!!document.querySelector('[data-testid=choose-G70]')")
  await shot("local-v1-vehicle-chooser")
  await evaluate("document.querySelector('[data-testid=choose-G70]').click()")
  await wait("document.querySelector('[data-testid=mission-view]')?.dataset.vehicle === 'G70'")
  assert.ok(await evaluate("document.querySelector('h1').textContent.includes('7 Series')"))
  assert.ok(await evaluate("document.querySelector('.mc-vehicle-image').getAttribute('src').includes('7-series')"))
  assert.ok(await evaluate("document.querySelector('[data-testid=mission-view]').innerText.includes('8.0')"), "Satisfaction updates with the selected car")
  await wait("[...document.querySelectorAll('.mc-vehicle-image')].every(i => i.complete && i.naturalWidth > 0)")
  await shot("local-v1-7-series")
  await evaluate("document.querySelector('[data-testid=market-CN]').click()")
  await wait("document.querySelector('[data-testid=mission-view]')?.dataset.market === 'CN'")
  assert.equal(await evaluate("document.querySelector('[data-testid=comment-count]').textContent"), "0")
  assert.ok(await evaluate("document.querySelector('[data-testid=mission-view]').innerText.includes('No internal feedback for China')"))
  assert.ok(await evaluate("document.querySelector('[data-testid=mission-view]').innerText.includes('9.6')"))
  await evaluate("document.querySelector('[data-testid=market-US]').click()")
  await wait("document.querySelector('[data-testid=mission-view]')?.dataset.market === 'US'")
  assert.ok(await evaluate("document.querySelector('[data-testid=study-summary]').innerText.includes('No comparable study mean')"), "US cannot inherit a European study score")
  await cdp("Page.navigate", { url: `${base}/?v=G60&m=all` })
  await wait("document.querySelector('[data-testid=mission-view]')?.dataset.vehicle === 'G60' && document.querySelector('[data-testid=mission-view]')?.dataset.market === 'all'")
  await wait("document.readyState === 'complete' && [...document.querySelectorAll('.mc-vehicle-image')].every(i => i.complete && i.naturalWidth > 0)")
  await evaluate("document.querySelector('[data-testid=topic-negative-0]').click()")
  await wait("!!document.querySelector('[data-testid=topic-evidence]')")
  assert.ok(await evaluate("!!document.querySelector('[data-testid=topic-evidence] a[href^=\"/evidence/comment/\"]')"), "A topic reveals real linked internal evidence")
  await shot("local-v1-evidence-drawer")
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 })
  await wait("!document.querySelector('[data-testid=topic-evidence]')")
  await evaluate("document.querySelector('[data-testid=sentiment-positive]').click()")
  assert.ok(await evaluate("document.querySelector('[data-testid=sentiment-positive]').getAttribute('aria-pressed') === 'true'"))
  await evaluate("document.querySelector('[aria-label=\"Toggle light or dark mode\"]').click()")
  await wait("document.documentElement.classList.contains('dark')")
  await shot("local-v1-dark")
  await evaluate("document.querySelector('[aria-label=\"Toggle light or dark mode\"]').click()")
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await wait("innerWidth === 390")
  assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "Mobile has no horizontal overflow")
  await shot("local-v1-mobile", true)
  assert.equal(exceptions.length, 0, "No uncaught browser exceptions")
  console.log("PASS: large chooser, supplied images, vehicle + market updates, missing-data honesty, evidence drawer, sentiment controls, dark mode, mobile overflow, browser exceptions")
} finally {
  await cdp("Browser.close", {}, null).catch(() => {}); chrome.kill()
  await rm(profile, { recursive: true, force: true }).catch(() => {})
}
