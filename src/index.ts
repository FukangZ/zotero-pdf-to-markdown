import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";

const basicTool = new BasicTool();

// @ts-expect-error - Plugin instance is not typed
if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  _globalThis.addon = new Addon();
  if ((globalThis as object) !== (_globalThis as object)) {
    defineGlobalOn(globalThis, "addon", () => _globalThis.addon);
    defineGlobalOn(
      globalThis,
      "ztoolkit",
      () => _globalThis.addon.data.ztoolkit,
    );
  }
  defineGlobal("ztoolkit", () => {
    return _globalThis.addon.data.ztoolkit;
  });
  // @ts-expect-error - Plugin instance is not typed
  Zotero[config.addonInstance] = addon;
}

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => any): void;
function defineGlobal(name: string, getter?: () => any) {
  defineGlobalOn(_globalThis, name, getter);
}

function defineGlobalOn(target: object, name: string, getter?: () => any) {
  Object.defineProperty(target, name, {
    configurable: true,
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}
