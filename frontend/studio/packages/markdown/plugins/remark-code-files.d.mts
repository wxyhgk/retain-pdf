import type { Root } from 'mdast';
import type { VFile } from 'vfile';

export default function remarkCodeFiles(options?: { skip?: readonly string[] }): (tree: Root, file: VFile) => void;
