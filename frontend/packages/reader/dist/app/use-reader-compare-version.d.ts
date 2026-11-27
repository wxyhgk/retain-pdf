import type { ReaderWorkspaceMode } from "../components/react-pdf/index.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { ReaderPaneComposition } from "./pane-composition.js";
export declare function useReaderCompareVersion(c: ReaderReactController, visiblePdfMode: ReaderPaneComposition["visibleMode"], changeWorkspace: (next: ReaderWorkspaceMode) => void): {
    versionCompare: import("../hooks/use-reader-version-compare.js").VersionCompare;
    compareVersion: {
        url: string;
        regions: import("../runtime/data.js").ReaderRegion[];
        left: {
            name: string;
            createdAt: string;
        };
        right: {
            name: string;
            createdAt: string;
        };
    };
};
//# sourceMappingURL=use-reader-compare-version.d.ts.map