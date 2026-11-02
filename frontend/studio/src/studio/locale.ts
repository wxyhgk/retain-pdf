// The page's language, first of all (main.ts imports this before anything else): the words of every module after
// it are in it, those worked out as a module loads too.
import { usePageLocale } from '@blog/i18n/page.ts';

usePageLocale();
