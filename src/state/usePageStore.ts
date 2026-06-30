import { create } from 'zustand';

import * as pageStore from '../services/storage/pageStore';
import type { Page } from '../types/page';
import { generateId } from '../utils/id';

type PageStoreState = {
  pages: Page[];
  loaded: boolean;
  loadPages: () => Promise<void>;
  createPage: () => Promise<Page>;
  updatePage: (page: Page) => Promise<void>;
  removePage: (id: string) => Promise<void>;
};

export const usePageStore = create<PageStoreState>((set, get) => ({
  pages: [],
  loaded: false,

  loadPages: async () => {
    const pages = await pageStore.loadAllPages();
    set({ pages: pages.sort((a, b) => b.updatedAt - a.updatedAt), loaded: true });
  },

  createPage: async () => {
    const now = Date.now();
    const page: Page = {
      id: generateId(),
      title: 'New Page',
      createdAt: now,
      updatedAt: now,
      backgroundImageUri: null,
      backgroundImageWidth: 0,
      backgroundImageHeight: 0,
      inkBase64: null,
      annotations: [],
    };
    await pageStore.savePage(page);
    set({ pages: [page, ...get().pages] });
    return page;
  },

  updatePage: async (page: Page) => {
    await pageStore.savePage(page);
    const updated = { ...page, updatedAt: Date.now() };
    set({
      pages: [updated, ...get().pages.filter((existing) => existing.id !== page.id)].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      ),
    });
  },

  removePage: async (id: string) => {
    await pageStore.deletePage(id);
    set({ pages: get().pages.filter((page) => page.id !== id) });
  },
}));
