export type CatalogIssue = "deleted" | "unavailable";

export interface CatalogItemMetadata {
  catalogIssue?: CatalogIssue;
  isPlaceholder?: boolean;
}
