// Países por código ISO 3166-1 alfa-2. En la base solo se guarda el código
// (recetas.paisOrigen); el nombre en español se resuelve acá, en el cliente.

export const CODIGOS_PAISES = `
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
  BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
  CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
  DE DJ DK DM DO DZ
  EC EE EG EH ER ES ET
  FI FJ FK FM FO FR
  GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
  HK HM HN HR HT HU
  ID IE IL IM IN IO IQ IR IS IT
  JE JM JO JP
  KE KG KH KI KM KN KP KR KW KY KZ
  LA LB LC LI LK LR LS LT LU LV LY
  MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
  NA NC NE NF NG NI NL NO NP NR NU NZ
  OM
  PA PE PF PG PH PK PL PM PN PR PS PT PW PY
  QA
  RE RO RS RU RW
  SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
  TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
  UA UG UM US UY UZ
  VA VC VE VG VI VN VU
  WF WS
  YE YT
  ZA ZM ZW
`.trim().split(/\s+/);

const VALIDOS = new Set(CODIGOS_PAISES);
const nombres = new Intl.DisplayNames(['es'], { type: 'region' });

// Nombre en español del país; si el código no está en la lista, devuelve el código.
// Se filtra antes de consultar a Intl: ICU trata ZZ (y otros códigos sin asignar)
// como "Región desconocida" en lugar de devolver el código.
export function nombrePais(codigo) {
  if (!VALIDOS.has(codigo)) return codigo;
  try {
    return nombres.of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

// Llena un <select> con una primera opción de valor '' (textoPrimera) y los países
// ordenados por nombre en español.
export function llenarSelectPaises(select, textoPrimera) {
  const primera = document.createElement('option');
  primera.value = '';
  primera.textContent = textoPrimera;

  const opciones = CODIGOS_PAISES
    .map((codigo) => ({ codigo, nombre: nombrePais(codigo) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map(({ codigo, nombre }) => {
      const op = document.createElement('option');
      op.value = codigo;
      op.textContent = nombre;
      return op;
    });

  select.replaceChildren(primera, ...opciones);
}
