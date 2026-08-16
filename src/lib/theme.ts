export const THEME_STORAGE_KEY = "lc-theme";

export type Theme = "light" | "dark";

/**
 * Rutas que ignoran la preferencia y se muestran siempre claras.
 *
 * /reparto se usa en la calle, de dia y con el celular al sol. El modo oscuro
 * con reflejo es directamente ilegible, y el repartidor no esta en posicion de
 * ponerse a buscar un toggle.
 */
export function isForcedLightPath(pathname: string) {
  return pathname === "/reparto" || pathname.startsWith("/reparto/");
}

/**
 * Se inyecta inline en <head> y corre antes del primer paint. Si esto viviera
 * en un componente de React, la pagina pintaria una vez en claro antes de
 * corregirse, que es el parpadeo clasico.
 *
 * El default es claro, no la preferencia del sistema: el panel se usa de dia y
 * la mayoria de los sistemas vienen en oscuro por moda, no por eleccion. Quien
 * quiera oscuro lo pide una vez con el toggle y queda guardado.
 *
 * Deliberadamente sin dependencias y a prueba de localStorage bloqueado
 * (Safari en modo privado tira al leerlo).
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var p=location.pathname;
if(p==="/reparto"||p.indexOf("/reparto/")===0)return;
if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.classList.add("dark");
}catch(e){}})();`;
