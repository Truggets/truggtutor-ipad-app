export type Region = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ChecklistAnnotation = {
  id: string;
  kind: 'checklist';
  region: Region;
  steps: string[];
  createdAt: number;
};

export type Annotation = ChecklistAnnotation;

export type Page = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  backgroundImageUri: string | null;
  backgroundImageWidth: number;
  backgroundImageHeight: number;
  inkBase64: string | null;
  annotations: Annotation[];
};
