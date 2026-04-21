import { Platform } from "react-native";
import Constants from "expo-constants";
import { DateTime } from "luxon";
import { Importance } from "../types";

export const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const normalizeLocationText = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const getCountryDisplayName = (countryCode?: string | null) => {
  if (!countryCode) return "";
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(countryCode.toUpperCase()) || countryCode;
  } catch {
    return countryCode;
  }
};

export const splitPhoneParts = (value: string, phoneCodes: string[]) => {
  const trimmed = value.trim();
  const code = phoneCodes.find((item) => trimmed.startsWith(item)) || "";
  const number = code ? trimmed.slice(code.length).trim() : trimmed;
  return { code, number };
};

export const resolveTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const getExpoHost = () => {
  const candidates = [
    (Constants as { expoConfig?: { hostUri?: string } }).expoConfig?.hostUri,
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2?.extra?.expoClient?.hostUri,
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const host = candidate.split(",")[0]?.split(":")[0]?.trim();
    if (host) return host;
  }
  return null;
};

export const resolveApiBaseUrl = () => {
  const configured = (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined)?.trim();
  if (configured) return trimTrailingSlash(configured);
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:3000`;
  }
  const expoHost = getExpoHost();
  if (expoHost) return `http://${expoHost}:3000`;
  return Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";
};

export const isoToday = () => new Date().toISOString().slice(0, 10);

export const expandDateRange = (startIso: string, endIso: string) => {
  const start = DateTime.fromISO(startIso).startOf("day");
  const end = DateTime.fromISO(endIso).startOf("day");
  if (!start.isValid || !end.isValid) return [];
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    const iso = cursor.toISODate();
    if (iso) dates.push(iso);
    cursor = cursor.plus({ days: 1 });
  }
  return dates;
};

export const formatTime = (iso: string, zone: string) => {
  const dt = DateTime.fromISO(iso, { zone });
  if (!dt.isValid) return "Hora";
  return dt.toFormat("HH:mm");
};

export const formatDateTime = (iso: string, zone: string) => {
  const dt = DateTime.fromISO(iso, { zone });
  if (!dt.isValid) return "Fecha";
  return dt.toFormat("dd LLL · HH:mm");
};

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  return fallback;
};

export const nullIfBlank = (value: string) => (value.trim().length ? value : null);

export const cleanOptionalText = (value: unknown) => {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!v) return "";
  if (v.toLowerCase() === "null") return "";
  return value;
};

export const decodeJwtPayload = (jwt: string): Record<string, unknown> | null => {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    if (typeof atob !== "function") return null;
    const json = atob(padded);
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

export const passwordStrength = (pwd: string) => {
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (pwd.length >= 10) score += 1;
  return score;
};

export const importanceColorMap: Record<Importance, string> = {
  low: "#10b981",
  medium: "#2563eb",
  high: "#f97316",
};

export const importanceLabelMap: Record<Importance, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const COUNTRY_OPTIONS = [
  "Afganistán","Albania","Alemania","Andorra","Angola","Arabia Saudita","Argelia","Argentina",
  "Armenia","Australia","Austria","Azerbaiyán","Bahamas","Bangladés","Barbados","Baréin",
  "Bélgica","Belice","Benín","Bielorrusia","Birmania","Bolivia","Bosnia y Herzegovina",
  "Botsuana","Brasil","Brunéi","Bulgaria","Burkina Faso","Burundi","Bután","Cabo Verde",
  "Camboya","Camerún","Canadá","Catar","Chad","Chile","China","Chipre","Colombia","Comoras",
  "Corea del Norte","Corea del Sur","Costa Rica","Croacia","Cuba","Dinamarca","Dominica",
  "Ecuador","Egipto","El Salvador","Emiratos Árabes Unidos","Eritrea","Eslovaquia","Eslovenia",
  "España","Estados Unidos","Estonia","Esuatini","Etiopía","Filipinas","Finlandia","Fiyi",
  "Francia","Gabón","Gambia","Georgia","Ghana","Granada","Grecia","Guatemala","Guinea",
  "Guinea-Bisáu","Guinea Ecuatorial","Guyana","Haití","Honduras","Hungría","India","Indonesia",
  "Irak","Irán","Irlanda","Islandia","Islas Marshall","Islas Salomón","Israel","Italia",
  "Jamaica","Japón","Jordania","Kazajistán","Kenia","Kirguistán","Kiribati","Kuwait","Laos",
  "Lesoto","Letonia","Líbano","Liberia","Libia","Liechtenstein","Lituania","Luxemburgo",
  "Madagascar","Malasia","Malaui","Maldivas","Malí","Malta","Marruecos","Mauricio","Mauritania",
  "México","Micronesia","Moldavia","Mónaco","Mongolia","Montenegro","Mozambique","Namibia",
  "Nauru","Nepal","Nicaragua","Níger","Nigeria","Noruega","Nueva Zelanda","Omán","Países Bajos",
  "Pakistán","Palaos","Panamá","Papúa Nueva Guinea","Paraguay","Perú","Polonia","Portugal",
  "Reino Unido","República Centroafricana","República Checa","República del Congo",
  "República Democrática del Congo","República Dominicana","Ruanda","Rumania","Rusia",
  "Samoa","San Cristóbal y Nieves","San Marino","San Vicente y las Granadinas","Santa Lucía",
  "Santo Tomé y Príncipe","Senegal","Serbia","Seychelles","Sierra Leona","Singapur","Siria",
  "Somalia","Sri Lanka","Sudáfrica","Sudán","Sudán del Sur","Suecia","Suiza","Surinam",
  "Tailandia","Tanzania","Tayikistán","Timor Oriental","Togo","Tonga","Trinidad y Tobago",
  "Túnez","Turkmenistán","Turquía","Tuvalu","Ucrania","Uganda","Uruguay","Uzbekistán",
  "Vanuatu","Vaticano","Venezuela","Vietnam","Yemen","Yibuti","Zambia","Zimbabue",
];

export const defaultTimezones = [
  "UTC","Asia/Tokyo","Asia/Seoul","Asia/Singapore","Asia/Shanghai","Asia/Hong_Kong",
  "Asia/Dubai","Asia/Bangkok","Asia/Kolkata","Asia/Jakarta",
];

export const asiaCountries = [
  "Japan","Korea, Republic of","Singapore","China","Hong Kong","Taiwan",
  "United Arab Emirates","Saudi Arabia","Thailand","Viet Nam","Philippines","Indonesia","India",
];

export const phoneCodes = ["+81","+82","+65","+86","+852","+886","+971","+966","+66","+84","+63","+62","+91"];

export const serviceTemplates: { name: string; durationMin: number; priceYen: number }[] = [
  { name: "Consulta inicial", durationMin: 30, priceYen: 0 },
  { name: "Servicio estandar", durationMin: 60, priceYen: 5000 },
  { name: "Servicio premium", durationMin: 90, priceYen: 8000 },
  { name: "Seguimiento", durationMin: 45, priceYen: 3000 },
];
