import cities from "all-the-cities";
import { countries } from "countries-list";

const majorCityPopulation = 100_000;

export async function GET(request: Request) {
  const requestedCode = new URL(request.url).searchParams.get("country")?.toUpperCase();
  const countryEntry = Object.entries(countries).find(([code]) => code === requestedCode);
  if (!countryEntry) return Response.json({ error: "Choose a valid country." }, { status: 400 });

  const [countryCode, country] = countryEntry;
  const names = new Set(
    cities
      .filter((city) => city.country === countryCode && (city.population >= majorCityPopulation || city.featureCode === "PPLC"))
      .map(({ name }) => name.trim())
      .filter(Boolean),
  );
  if (country.capital) names.add(country.capital);

  return Response.json(
    { cities: [...names].sort((left, right) => left.localeCompare(right)) },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } },
  );
}
