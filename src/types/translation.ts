import { Phrases } from "@prismatic-io/translations";

interface EmdeddedPhrases extends Phrases {
  dynamicPhrase: { [x: string]: string };
}

export interface Translation {
  debugMode?: boolean;
  phrases?: EmdeddedPhrases;
}
