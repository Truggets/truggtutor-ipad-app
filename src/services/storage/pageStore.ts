import { Directory, File, Paths } from 'expo-file-system';

import type { ChecklistStep, ChecklistStepStatus, Page } from '../../types/page';

const MANIFEST_FILE_NAME = 'pages.json';
const IMAGES_DIR_NAME = 'page-images';

function manifestFile(): File {
  return new File(Paths.document, MANIFEST_FILE_NAME);
}

function imagesDirectory(): Directory {
  const dir = new Directory(Paths.document, IMAGES_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

function normalizeChecklistStep(step: unknown): ChecklistStep | null {
  if (typeof step === 'string') {
    return { text: step, status: 'unchecked' };
  }
  if (!step || typeof step !== 'object') return null;

  const candidate = step as Partial<ChecklistStep>;
  if (typeof candidate.text !== 'string') return null;
  const validStatuses: ChecklistStepStatus[] = ['unchecked', 'correct', 'incorrect'];
  const status = validStatuses.includes(candidate.status as ChecklistStepStatus)
    ? (candidate.status as ChecklistStepStatus)
    : 'unchecked';

  return {
    text: candidate.text,
    status,
    ...(status === 'incorrect' && typeof candidate.hint === 'string' ? { hint: candidate.hint } : {}),
  };
}

function normalizePage(page: Page): Page {
  return {
    ...page,
    annotations: (page.annotations ?? []).map((annotation) => ({
      ...annotation,
      steps: (annotation.steps as unknown[]).map(normalizeChecklistStep).filter((step) => step !== null),
    })),
  };
}

export async function loadAllPages(): Promise<Page[]> {
  const file = manifestFile();
  if (!file.exists) {
    return [];
  }
  const contents = await file.text();
  if (!contents) {
    return [];
  }
  try {
    return (JSON.parse(contents) as Page[]).map(normalizePage);
  } catch {
    return [];
  }
}

async function writeAllPages(pages: Page[]): Promise<void> {
  const file = manifestFile();
  if (!file.exists) {
    file.create();
  }
  file.write(JSON.stringify(pages));
}

export async function getPage(id: string): Promise<Page | null> {
  const pages = await loadAllPages();
  return pages.find((page) => page.id === id) ?? null;
}

export async function savePage(page: Page): Promise<void> {
  const pages = await loadAllPages();
  const index = pages.findIndex((existing) => existing.id === page.id);
  const updated = { ...page, updatedAt: Date.now() };
  if (index === -1) {
    pages.push(updated);
  } else {
    pages[index] = updated;
  }
  await writeAllPages(pages);
}

export async function deletePage(id: string): Promise<void> {
  const pages = await loadAllPages();
  await writeAllPages(pages.filter((page) => page.id !== id));
}

/**
 * Picked/captured images live in a transient cache that can be cleared by the
 * OS, so we copy them into the app's document directory before referencing
 * them from a Page.
 */
export async function persistImageFromUri(sourceUri: string, pageId: string): Promise<string> {
  const sourceFile = new File(sourceUri);
  const extension = sourceFile.extension || '.jpg';
  const destination = new File(imagesDirectory(), `${pageId}${extension}`);
  if (destination.exists) {
    destination.delete();
  }
  await sourceFile.copy(destination);
  return destination.uri;
}
