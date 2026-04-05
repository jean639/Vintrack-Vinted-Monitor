export type ItemStatus = {
  id: string;
  label: string;
  description: string;
  tone: string;
  labels: Record<string, string>;
  descriptions?: Record<string, string>;
  aliases: string[];
};

export const ITEM_STATUSES: ItemStatus[] = [
  {
    id: "6",
    label: "New with tags",
    description: "Unused item with original tags attached.",
    tone: "emerald",
    labels: {
      en: "New with tags",
      de: "Neu mit Etikett",
      fr: "Neuf avec étiquette",
      it: "Nuovo con cartellino",
      es: "Nuevo con etiquetas",
      nl: "Nieuw met prijskaartje",
      pt: "Novo com etiqueta",
      pl: "Nowy z metką",
      cs: "Nové s visačkou",
      sk: "Nové s visačkou",
      fi: "Uusi, jossa hintalappu",
      lt: "Nauja su etikete",
      hu: "Új címkével",
      ro: "Nou cu etichetă",
      hr: "Novo s etiketom",
      sl: "Novo z etiketo",
      da: "Ny med prismærke",
      sv: "Ny med prislapp",
      el: "Καινούριο με ετικέτα"
    },
    aliases: [
      "New with tags",
      "Neu mit Etikett",
      "Neuf avec étiquette",
      "Nuovo con cartellino",
      "Nuevo con etiquetas",
      "Nieuw met prijskaartje",
      "Novo com etiqueta",
      "Nowy z metką",
      "Nové s visačkou",
      "Uusi, jossa hintalappu"
    ]
  },
  {
    id: "1",
    label: "New",
    description: "Unused item without visible wear.",
    tone: "sky",
    labels: {
      en: "New",
      de: "Neu",
      fr: "Neuf sans étiquette",
      it: "Nuovo senza cartellino",
      es: "Nuevo sin etiquetas",
      nl: "Nieuw zonder prijskaartje",
      pt: "Novo sem etiqueta",
      pl: "Nowy bez metki",
      cs: "Nové bez visačky",
      sk: "Nové bez visačky",
      fi: "Uusi ilman hintalappua",
      lt: "Nauja be etiketės",
      hu: "Új címke nélkül",
      ro: "Nou fără etichetă",
      hr: "Novo bez etikete",
      sl: "Novo brez etikete",
      da: "Ny uden prismærke",
      sv: "Ny utan prislapp",
      el: "Καινούριο χωρίς ετικέτα"
    },
    aliases: [
      "New",
      "Neu",
      "Neuf sans étiquette",
      "Nuovo senza cartellino",
      "Nuevo sin etiquetas",
      "Nieuw zonder prijskaartje",
      "Novo sem etiqueta",
      "Nowy bez metki",
      "Nové bez visačky",
      "Uusi ilman hintalappua"
    ]
  },
  {
    id: "2",
    label: "Very good",
    description: "Light wear, still looks almost new.",
    tone: "indigo",
    labels: {
      en: "Very good",
      de: "Sehr gut",
      fr: "Très bon état",
      it: "Ottime condizioni",
      es: "Muy bueno",
      nl: "Heel goed",
      pt: "Muito bom",
      pl: "Bardzo dobry",
      cs: "Velmi dobrý",
      sk: "Veľmi dobrý",
      fi: "Erittäin hyvä",
      lt: "Labai gera",
      hu: "Nagyon jó",
      ro: "Foarte bună",
      hr: "Vrlo dobro",
      sl: "Zelo dobro",
      da: "Meget god",
      sv: "Mycket bra",
      el: "Πολύ καλή"
    },
    aliases: [
      "Very good",
      "Sehr gut",
      "Très bon état",
      "Ottime condizioni",
      "Muy bueno",
      "Heel goed",
      "Muito bom",
      "Bardzo dobry",
      "Velmi dobrý",
      "Erittäin hyvä"
    ]
  },
  {
    id: "3",
    label: "Good",
    description: "Visible wear, but still in solid condition.",
    tone: "amber",
    labels: {
      en: "Good",
      de: "Gut",
      fr: "Bon état",
      it: "Buone condizioni",
      es: "Bueno",
      nl: "Goed",
      pt: "Bom",
      pl: "Dobry",
      cs: "Dobrý",
      sk: "Dobrý",
      fi: "Hyvä",
      lt: "Gera",
      hu: "Jó",
      ro: "Bună",
      hr: "Dobro",
      sl: "Dobro",
      da: "God",
      sv: "Bra",
      el: "Καλή"
    },
    aliases: [
      "Good",
      "Gut",
      "Bon état",
      "Buone condizioni",
      "Bueno",
      "Goed",
      "Bom",
      "Dobry",
      "Dobrý",
      "Hyvä"
    ]
  },
  {
    id: "4",
    label: "Satisfactory",
    description: "Noticeable wear or flaws are acceptable.",
    tone: "rose",
    labels: {
      en: "Satisfactory",
      de: "Zufriedenstellend",
      fr: "Satisfaisant",
      it: "Discrete condizioni",
      es: "Aceptable",
      nl: "Redelijk",
      pt: "Satisfatório",
      pl: "Zadowalający",
      cs: "Uspokojivý",
      sk: "Uspokojivý",
      fi: "Tyydyttävä",
      lt: "Patenkinama",
      hu: "Megfelelő",
      ro: "Satisfăcătoare",
      hr: "Zadovoljavajuće",
      sl: "Zadovoljivo",
      da: "Tilfredsstillende",
      sv: "Tillfredsställande",
      el: "Ικανοποιητική"
    },
    aliases: [
      "Satisfactory",
      "Zufriedenstellend",
      "Satisfaisant",
      "Discrete condizioni",
      "Aceptable",
      "Redelijk",
      "Satisfatório",
      "Zadowalający",
      "Uspokojivý",
      "Tyydyttävä"
    ]
  }
];

const ITEM_STATUS_BY_ID: Record<string, ItemStatus> = Object.create(null);
for (const status of ITEM_STATUSES) {
  ITEM_STATUS_BY_ID[status.id] = status;
}

export function getStatusValues(statusIds: string | null | undefined): string[] {
  if (!statusIds) return [];

  return statusIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function getStatusLabel(id: string, locale = "en"): string {
  const status = ITEM_STATUS_BY_ID[id];
  if (!status) return `Status ${id}`;
  return status.labels[locale] ?? status.label;
}

export function getStatusLabels(statusIds: string | null | undefined, locale = "en"): string[] {
  return getStatusValues(statusIds).map((id) => getStatusLabel(id, locale));
}
