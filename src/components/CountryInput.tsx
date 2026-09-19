import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { Country } from "../data/countries";
import { searchCountries } from "../game/search";
import styles from "./CountryInput.module.css";

const MAX_SUGGESTIONS = 6;

interface CountryInputProps {
  onSelect: (country: Country) => void;
  shakeToken: number;
}

export function CountryInput({ onSelect, shakeToken }: CountryInputProps) {
  const listId = useId();
  const optionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Country[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [open, setOpen] = useState(false);

  const [settledToken, setSettledToken] = useState(shakeToken);
  if (settledToken !== shakeToken) {
    setSettledToken(shakeToken);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    const matches = searchCountries(value, MAX_SUGGESTIONS);
    setSuggestions(matches);
    setHighlighted(0);
    setOpen(matches.length > 0);
  }, []);

  const choose = useCallback(
    (country: Country) => {
      setOpen(false);
      inputRef.current?.focus();
      onSelect(country);
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!open || suggestions.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlighted((index) => (index + 1) % suggestions.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlighted((index) => (index - 1 + suggestions.length) % suggestions.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const country = suggestions[highlighted];
        if (country) choose(country);
      }
    },
    [choose, highlighted, open, suggestions],
  );

  return (
    <div className={styles.field}>
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        value={query}
        onChange={(event) => updateQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(suggestions.length > 0)}
        placeholder="Name that country"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Country guess"
        aria-activedescendant={
          open && suggestions[highlighted] ? `${optionId}-${highlighted}` : undefined
        }
      />
      {open && (
        <ul
          className={styles.list}
          id={listId}
          role="listbox"
          aria-label="Matching countries"
          // Keep focus in the input so a click on an option never closes the list first.
          onMouseDown={(event) => event.preventDefault()}
        >
          {suggestions.map((country, index) => (
            // Options are not individually focusable; the combobox input owns keyboard navigation.
            // oxlint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={country.code}
              id={`${optionId}-${index}`}
              role="option"
              aria-selected={index === highlighted}
              className={`${styles.option} ${index === highlighted ? styles.optionActive : ""}`}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => choose(country)}
            >
              {country.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
