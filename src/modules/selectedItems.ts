type ZoteroPaneToolkit = {
  getGlobal(name: "ZoteroPane"): _ZoteroTypes.ZoteroPane;
};

export function getSelectedRegularItems(): Zotero.Item[] {
  const items = getToolkit().getGlobal("ZoteroPane").getSelectedItems();
  return items.filter((item) => item.isRegularItem() && !item.isFeedItem);
}

function getToolkit(): ZoteroPaneToolkit {
  const globals = globalThis as typeof globalThis & {
    addon?: { data?: { ztoolkit?: ZoteroPaneToolkit } };
    ztoolkit?: ZoteroPaneToolkit;
  };
  const toolkit = globals.addon?.data?.ztoolkit ?? globals.ztoolkit;

  if (!toolkit) {
    throw new Error("Zotero toolkit is not initialized");
  }

  return toolkit;
}
