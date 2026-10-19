import type { Blocks } from './blocks.mjs';
import type { PluginModule } from './index.mjs';

export declare function buildBlocks(...modules: PluginModule[]): Promise<Blocks>;
