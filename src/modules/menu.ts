import { runGenerateMarkdownCommand } from "./command";
import { readPluginPrefs } from "./prefs";

export function registerItemMenu(): void {
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: "zotero-itemmenu-zoteropdftomarkdown-generate",
    label: "从 PDF 生成 Markdown 附件",
    commandListener: async () => {
      const win = Zotero.getMainWindow();

      try {
        await runGenerateMarkdownCommand(readPluginPrefs());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Zotero.logError(error instanceof Error ? error : new Error(message));
        win.alert(`Zotero PDF to Markdown command failed:\n\n${message}`);
      }
    },
  });
}
