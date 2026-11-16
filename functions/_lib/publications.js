/**
 * Explicitly approved public articles only.
 * Jay retired the old automatic blog on November 15, 2026.
 * Keep old feed items out. New videos, transcripts and Reddit-derived articles
 * require Jay's review before adding a complete record here.
 *
 * Record fields: slug, title, author ('jay'), published_at (YYYY-MM-DD),
 * meta_description, body (Markdown). Include a source/video link in body.
 * Never invent personal experiences, client examples or quotations.
 */
export const PUBLISHED_POSTS = [];
