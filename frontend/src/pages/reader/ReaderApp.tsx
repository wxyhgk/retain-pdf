// Root điều phối trình đọc: mặc định dùng engine react-pdf; ?engine=legacy để quay về boot kiểu mệnh lệnh.

import { useMemo, useState } from "react";
import { ReaderBootLoading } from "./legacy/components/ReaderBootLoading.jsx";
import { ReaderTopbar } from "./legacy/components/ReaderTopbar.jsx";
import { ReaderTopbarActions } from "./legacy/components/ReaderTopbarActions.jsx";
import { ReaderLeftNav } from "./legacy/components/ReaderLeftNav.jsx";
import { ReaderColumnChrome } from "./legacy/components/ReaderColumnChrome.jsx";
import { ReaderScrollShell } from "./legacy/components/ReaderScrollShell.jsx";
import {
  ReaderAiDrawer,
  ReaderAnnotationsDrawer,
  ReaderFavoritesDrawer,
  ReaderMarkdownDrawer,
} from "./legacy/components/ReaderSideDrawers.jsx";
import { DownloadToastHost } from "../../shared/react/DownloadToastHost.jsx";
import { createReaderDrawerStore } from "./legacy/state/drawer-store.js";
import { useReaderBoot } from "./legacy/hooks/use-reader-boot.js";
import { ReaderAppReactPdf } from "./ReaderAppReactPdf.jsx";
import { ReaderCloseHome } from "./components/react-pdf/ReaderCloseHome.jsx";

function resolveReaderEngine(search = globalThis.location?.search || "") {
  const engine = new URLSearchParams(search).get("engine")?.trim().toLowerCase() || "";
  if (engine === "legacy" || engine === "classic") {
    return "legacy";
  }
  // Mặc định dùng toàn bộ React + react-pdf
  return "react-pdf";
}

function ReaderAppLegacy() {
  const [drawerStore] = useState(() => createReaderDrawerStore());
  const runtime = useReaderBoot(drawerStore);
  return (
    <>
      <ReaderBootLoading />
      <ReaderCloseHome />
      <ReaderTopbar />
      <ReaderTopbarActions drawerStore={drawerStore} downloadContext={runtime.downloads} />
      <ReaderLeftNav />
      <ReaderColumnChrome />
      <ReaderScrollShell />
      <ReaderFavoritesDrawer drawerStore={drawerStore} />
      <ReaderAnnotationsDrawer drawerStore={drawerStore} ports={runtime.annotations} />
      <ReaderMarkdownDrawer drawerStore={drawerStore} />
      <ReaderAiDrawer drawerStore={drawerStore} chatPorts={runtime.chat} />
      <DownloadToastHost />
    </>
  );
}

export function ReaderApp() {
  const engine = useMemo(() => resolveReaderEngine(), []);
  if (engine === "legacy") {
    return <ReaderAppLegacy />;
  }
  return <ReaderAppReactPdf />;
}
