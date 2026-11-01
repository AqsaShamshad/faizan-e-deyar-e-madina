"use client";

import { useEffect, useState } from "react";

const manualLocation = "__other__";

export type CountryOption = { code: string; name: string };

export function CalendarLocationPicker({
  countries,
  initialCity,
  initialCountry,
}: {
  countries: CountryOption[];
  initialCity: string;
  initialCountry: string;
}) {
  const matchedCountry = countries.find(({ code, name }) =>
    name.toLowerCase() === initialCountry.trim().toLowerCase() ||
    code.toLowerCase() === initialCountry.trim().toLowerCase() ||
    (["uk", "u.k.", "great britain"].includes(initialCountry.trim().toLowerCase()) && code === "GB") ||
    (["usa", "u.s.a.", "united states of america"].includes(initialCountry.trim().toLowerCase()) && code === "US"),
  );
  const [countryCode, setCountryCode] = useState(matchedCountry?.code ?? (initialCountry ? manualLocation : ""));
  const [manualCountry, setManualCountry] = useState(matchedCountry ? "" : initialCountry);
  const [city, setCity] = useState(initialCity);
  const [manualCity, setManualCity] = useState(matchedCountry || !initialCountry ? "" : initialCity);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(Boolean(matchedCountry));
  const [cityError, setCityError] = useState("");
  const selectedCountry = countries.find(({ code }) => code === countryCode);

  useEffect(() => {
    const requestCountry = selectedCountry;
    if (!requestCountry) return;
    const requestCountryCode = requestCountry.code;

    const controller = new AbortController();

    async function loadCities() {
      try {
        const response = await fetch(`/api/locations/cities?country=${encodeURIComponent(requestCountryCode)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not load cities for this country.");
        const payload: unknown = await response.json();
        if (
          typeof payload !== "object" ||
          payload === null ||
          !("cities" in payload) ||
          !Array.isArray(payload.cities) ||
          !payload.cities.every((value) => typeof value === "string")
        ) {
          throw new Error("The city list could not be read.");
        }
        setCityOptions(payload.cities);
      } catch (error) {
        if (controller.signal.aborted) return;
        setCityOptions([]);
        setCityError(error instanceof Error ? error.message : "Could not load cities.");
      } finally {
        if (!controller.signal.aborted) setLoadingCities(false);
      }
    }

    void loadCities();
    return () => controller.abort();
  }, [selectedCountry]);

  const cityIsManual = countryCode === manualLocation || city === manualLocation;
  const showSavedCity = city && city !== manualLocation && !cityOptions.includes(city);

  return (
    <div className="form-grid">
      <label className="field">
        <span>Country</span>
        <select
          required
          value={countryCode}
          onChange={(event) => {
            const nextCountry = event.target.value;
            setCountryCode(nextCountry);
            setCityOptions([]);
            setCityError("");
            setLoadingCities(Boolean(nextCountry && nextCountry !== manualLocation));
            if (nextCountry === manualLocation) {
              setManualCountry("");
              setManualCity(city === manualLocation ? manualCity : city);
              setCity(manualLocation);
            } else {
              setCity("");
              setManualCity("");
            }
          }}
        >
          <option value="">Choose a country</option>
          {countries.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
          <option value={manualLocation}>Other / enter manually</option>
        </select>
        {selectedCountry
          ? <input type="hidden" name="country" value={selectedCountry.name} />
          : <input
              name="country"
              required
              maxLength={100}
              placeholder="Enter country"
              value={manualCountry}
              onChange={(event) => setManualCountry(event.target.value)}
            />}
      </label>
      <label className="field">
        <span>City</span>
        {cityIsManual ? (
          <input
            name="city"
            required
            maxLength={100}
            placeholder="Enter city"
            value={manualCity}
            onChange={(event) => setManualCity(event.target.value)}
          />
        ) : (
          <>
            <select
              name="city"
              required
              value={city}
              disabled={!selectedCountry || loadingCities}
              onChange={(event) => {
                setCity(event.target.value);
                if (event.target.value === manualLocation) setManualCity("");
              }}
            >
              <option value="">{loadingCities ? "Loading cities…" : "Choose a city"}</option>
              {showSavedCity && <option value={city}>Saved city: {city}</option>}
              {cityOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              <option value={manualLocation}>Other / enter manually</option>
            </select>
            {cityError && <small role="status">{cityError} You can enter the city manually.</small>}
          </>
        )}
      </label>
    </div>
  );
}
