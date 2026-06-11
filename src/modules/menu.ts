import { runGenerateMarkdownCommand } from "./command";
import { readPluginPrefs } from "./prefs";
import { getString } from "../utils/locale";

export function registerItemMenu(): void {
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: "zotero-itemmenu-zoteropdftomarkdown-generate",
    label: getString("menu-generate-markdown"),
    commandListener: async () => {
      const win = Zotero.getMainWindow();

      try {
        await runGenerateMarkdownCommand(readPluginPrefs());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Zotero.logError(error instanceof Error ? error : new Error(message));
        win.alert(getString("command-failed", { args: { message } }));
      }
    },
  });
}
