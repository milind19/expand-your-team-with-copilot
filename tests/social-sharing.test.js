const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const vm = require("node:vm");

const appScript = readFileSync(`${__dirname}/../src/static/app.js`, "utf8");
const activityName = "Art & Design / \u670b\u53cb";
const activityId = `activity-${encodeURIComponent(activityName)}`;
const sharedUrl = `https://school.example/static/index.html#${activityId}`;

async function loadApp(clipboard) {
  const elements = new Map();
  const errors = [];
  let ready;
  let focused;
  let scrolled;

  function element(tagName = "div") {
    const node = {
      tagName,
      children: [],
      attributes: {},
      listeners: {},
      className: "",
      appendChild(child) { this.children.push(child); },
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, handler) { this.listeners[name] = handler; },
      querySelectorAll() { return []; },
      focus() { focused = this; },
      scrollIntoView() { scrolled = this; },
      select() { this.selected = true; },
    };
    Object.defineProperty(node, "innerHTML", {
      set(value) { this.children = []; this.markup = value; },
    });
    node.classList = {
      contains(name) { return node.className.split(" ").includes(name); },
      add(name) {
        if (!this.contains(name)) node.className += ` ${name}`;
      },
      remove(name) {
        node.className = node.className.split(" ").filter((item) => item !== name).join(" ");
      },
    };
    return node;
  }

  const document = {
    body: element("body"),
    addEventListener(event, handler) { if (event === "DOMContentLoaded") ready = handler; },
    createElement: element,
    getElementById(id) {
      if (id.startsWith("activity-") && id !== "activity-search") {
        return elements.get("activities-list")?.children.find((node) => node.id === id);
      }
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    querySelector(selector) {
      return selector.endsWith(".active") ? null : element();
    },
    querySelectorAll() { return []; },
  };
  vm.runInNewContext(appScript, {
    document,
    window: {
      location: {
        origin: "https://school.example",
        pathname: "/static/index.html",
        search: "?private=do-not-share",
        hash: `#${activityId}`,
      },
      addEventListener() {},
    },
    navigator: { clipboard },
    localStorage: { getItem() { return null; } },
    URL,
    URLSearchParams,
    console: { error(...args) { errors.push(args); } },
    fetch: async () => ({
      json: async () => ({
        [activityName]: {
          description: "Creative painting",
          schedule: "Tuesday, 3 PM",
          max_participants: 1,
          participants: ["student@school.example"],
        },
      }),
    }),
  });
  ready();
  await new Promise(setImmediate);
  const card = elements.get("activities-list").children[0];
  const sharing = card.children[0];
  const buttons = sharing.children[1].children;
  return {
    card, sharing, buttons, errors,
    manualLink: sharing.children[2],
    status: sharing.children[3],
    focused: () => focused,
    scrolled: () => scrolled,
  };
}

test("logged-out users can share full activities with encoded links and no participant data", async () => {
  const app = await loadApp();
  assert.equal(app.sharing.attributes["aria-label"], `Share ${activityName}`);
  const [whatsapp, facebook, x] = app.buttons.slice(0, 3).map((button) => new URL(button.href));
  assert.equal(whatsapp.origin, "https://wa.me");
  assert.equal(whatsapp.searchParams.get("text"), `Join me at ${activityName} at Mergington High School! ${sharedUrl}`);
  assert.equal(facebook.searchParams.get("u"), sharedUrl);
  assert.equal(x.searchParams.get("url"), sharedUrl);
  for (const button of app.buttons.slice(0, 3)) {
    assert.equal(button.target, "_blank");
    assert.equal(button.rel, "noopener noreferrer");
    assert.ok(!button.href.includes("student"));
    assert.ok(!button.href.includes("private"));
  }
  assert.equal(app.card.id, activityId);
  assert.equal(app.focused(), app.card);
  assert.equal(app.scrolled(), app.card);
});

test("copying reports success only after the clipboard receives the activity link", async () => {
  let copied;
  const app = await loadApp({ async writeText(value) { copied = value; } });
  await app.buttons[3].listeners.click();
  assert.equal(copied, sharedUrl);
  assert.equal(app.status.textContent, "Link copied!");
  assert.equal(app.status.attributes.role, "status");
  assert.equal(app.buttons[3].disabled, false);
});

test("missing or denied clipboard access offers a selected link for manual copying", async () => {
  for (const clipboard of [
    undefined,
    { async writeText() { throw new Error("Permission denied"); } },
  ]) {
    const app = await loadApp(clipboard);
    await app.buttons[3].listeners.click();
    assert.equal(app.manualLink.value, sharedUrl);
    assert.equal(app.manualLink.classList.contains("hidden"), false);
    assert.equal(app.manualLink.selected, true);
    assert.equal(app.focused(), app.manualLink);
    assert.equal(app.status.textContent, "Please copy the selected link to share it.");
    assert.equal(app.errors.length, clipboard ? 1 : 0);
  }
});
