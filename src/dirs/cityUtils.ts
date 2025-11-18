export function toCitySlug(city: string) {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatCityName(citySlug: string) {
  return citySlug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
