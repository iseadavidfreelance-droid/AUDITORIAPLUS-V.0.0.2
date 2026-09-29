/**
 * Normalización de Códigos de Auditoría AUDITORIAPLUS+
 * Regla de Negocio: Todo input ingresado debe normalizarse usando la función
 * LPAD(input, 6, '0') antes de enviarse al estado global.
 * 
 * Ejemplos:
 *  - "45"      -> "000045"
 *  - "789"     -> "000789"
 *  - "001234"  -> "001234"
 *  - "7591031" -> "7591031" (si ya tiene 6 o más caracteres no se trunca, se preserva íntegro)
 */
export function lpad(input: string | number, length = 6, padChar = '0'): string {
  const str = String(input ?? '').trim();
  if (str.length >= length) {
    return str;
  }
  return str.padStart(length, padChar);
}
