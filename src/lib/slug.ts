export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // diacritiques combinants après normalize NFD
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "ecole"
  );
}

export function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}
