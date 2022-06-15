const googleTranslate = require("google-translate-extended-api");
const axios = require("axios");
const cheerio = require("cheerio");
const reader = require("readline-sync");
const fs = require("fs");

const save_directory = "<path>"             // output result here as anki_import.txt

async function run() {

  while (true) {

    // get the initial data
    let word = reader.question(`Enter word:\n> `);
    if (word === "") continue;
    let google_data = await getData(word);
    let google_result = await getRootAndTranslations(google_data);
    let translation = google_result.translations;
    let accented_root = await getAccentAndAspect(google_result.root);

    // allow corrections if the result was fetched automatically
    if (google_result.manual === false) {
      console.log("\nRoot:",accented_root,"\nTranslation:",translation);
      let correction = reader.question("\nPress ENTER to confirm root or enter another:\n> ");
      if (correction !== "") {
        accented_root = await getAccentAndAspect(correction);         // set accent on new root
        let new_root_data = await getData(correction);                // check for alternative translations
        if (Object.keys(new_root_data.translations).length === 0){
          translation = new_root_data.translation;
        }
        else {
          translation = getTranslations(new_root_data.translations); 
        }
        console.log("Suggested translation:",translation);
      }
      correction = reader.question("Press ENTER to confirm translation or enter another:\n> ");
      if (correction !== "") {
        translation = correction;
      }
    }

    // get the example sentence
    let example = reader.question("Enter an example sentence:\n> ");

    // preview and save card (or not)
    console.log("\nRoot:",accented_root,"\nTranslation:",translation,"\nExample:",example);
    let confirmation = reader.question("\nPress ENTER to save card or anything else to start again:\n> ");
    if (confirmation == "") {
      let output = [accented_root,example,translation].join("\u0009") + "\n";   // separate with tabs
      fs.writeFileSync(save_directory + "anki_cards.txt", output, {flag: "a"}, err => {
        if (err) {
          console.error(err);
        }
      });
      console.log("Saved!\n");
    }
    else {
      console.log("Let’s start again…\n");
    }
  }
}

// get detailed translations and synonyms
// if detailed translations not found, Google may still suggest the root in the raw data, which may yield them
function getData(word) {
   return googleTranslate(word, "ru", "en", {detailedTranslationsSynonyms: true}).then((res) => {
    return res;
  }).catch(console.log);
}

// get the raw translation data for accessing the root word
// if no translations found, then [3][3][0][0] can be the "See also" field (=root)
// if translations are found, then [3][0] is the root field
function getRaw(word) {
  return googleTranslate(word, "ru", "en", {returnRawResponse: true}).then((res) => {
   return res;
 }).catch(console.log);
}

// return both word root and translations; allow manual input if root word not located
async function getRootAndTranslations(data) {
  const raw_data = await getRaw(data.word);                   // get the raw data so as to extract the root
  try {
    if (Object.keys(data.translations).length === 0) {        // 1) if no translations, get them from the root
      const root_data = await getData(raw_data[3][3][0][0]);  // will give error if no root found -> manual input
      return {
        "root": raw_data[3][3][0][0].replace(/\u0301/, "").toLowerCase(), // remove any ´ diacritics GT added
        "translations": getTranslations(root_data.translations),
        "manual": false                                                   // control so as not to ask correction twice
      }
    }
    else {                                                    // 2) if translations exist, put them in
      return {
        "root": raw_data[3][0].replace(/\u0301/, "").toLowerCase(),
        "translations": getTranslations(data.translations),
        "manual": false
      }
    }
  }
  catch {                     // if root cannot be found, throw error + try manually
    return manualInput(data); // exception is not the best way to do this but the raw data object seems unpredictable
  }
}

// get the top 4 translations out of the translations data object
function getTranslations(translations_data) {
  let translations = [];
  for (const [key_outer, value_outer] of Object.entries(translations_data)) {
    for (const [key_inner, value_inner] of Object.entries(value_outer)) {
      if (key_outer == "verb") {
        translations.push("to " + value_inner.translation);     // add infinitive marker
      }
      else {
        translations.push(value_inner.translation);
      }
    }
  }
  return translations.slice(0,4).join("; ");
}

// if no root is found, allow for manual input; try to get translations for this as well
async function manualInput(data) {
  let manual_root = data.word;                              // set default values if user just wishes to continue
  let root_data = data;
  let correction = reader.question(`No root found for ${data.word}. Press ENTER to continue or enter another:\n> `);
  if (correction !== "") {
    manual_root = correction;
    root_data = await getData(manual_root);
  }
  let translation = root_data.translation;                  // set default value
  if (Object.keys(root_data.translations).length !== 0){
    translation = getTranslations(root_data.translations); 
  }
  console.log("Suggested translation:",translation);
  correction = reader.question("Press ENTER to confirm translation or enter another:\n> ");
  if (correction !== "") {
    translation = correction;
  }
  return {
    "root": manual_root,
    "translations": translation,
    "manual": true
  }
}

// get the accent for the root form based on https://ru.wiktionary.org/; if the word is a verb, add aspect
async function getAccentAndAspect(word) {
  const url = encodeURI("https://ru.wiktionary.org/wiki/" + word);    // required to handle Cyrillic
  const page = await axios.get(url).catch(error => {                  
    if (error.response.status === 404){
      console.log(`No accent information found for ${word}.`)
    }
    else {
      console.log("An error occurred fetching the ru.wiktionary page:",error);
    }
    return {err: error};
  });
  if (page.err) {               // just return the word if no page exists
    return word;
  }         
  const $ = cheerio.load(page.data);
  const ps = $("p");
  let accent;
  ps.each((i,el) => {           // the accented word is the first non-blank <p> element
    if ($(el).text() != "") {
      accent = $(el);
      return false;             // break statement for cheerio .each() method
    }
  });
  const accented_word = accent.text().replaceAll("-","",).replaceAll("·","").trim();   // tidy up the word
  const description = accent.next();                                                   // next element is description
  if (description.find("a:nth-child(1)").text() == "Глагол") {                         // find out if a verb
    if (description.find("a:nth-child(2)").text() == "совершенный вид") {              // add marker for aspect
      return accented_word + " p";
    }                        
    else {
      return accented_word + " i";
    }
  }
  else {
    return accented_word;       // for non-verbs, just return normal accented word
  }
}

run();