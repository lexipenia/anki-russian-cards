# Anki Russian vocabulary cards
A terminal-based tool to accelerate making Russian vocabulary flashcards for [Anki](https://apps.ankiweb.net/).

This tool will:
* Retrieve the word root from a declined/conjugated form (if possible)
* Add accent marker and indicate verbal aspect (if possible)
* Provide the top translations from Google Translate
* Allow an example sentence to be provided
* Allow manual input/corrections at any step

Cards are output into a tab-separated `.txt` file for import into Anki, in the order `{{front}} {{example sentence}} {{back}}`. The path to this file should be specified in `save_directory` at the beginning of the script.

Initial data is fetched using [@FreddieDeWitt/google-translate-extended-api](https://github.com/FreddieDeWitt/google-translate-extended-api). Accents are searched on https://ru.wiktionary.org/.

## Dependencies
```
npm install google-translate-extended-api axios cheerio readline-sync
```

## Running
Just run the script with:
```
node anki-russian.js
```
Exit with `ctrl+C`.
