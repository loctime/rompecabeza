# Fuentes locales (offline)

Para que la PWA funcione sin red, incluye aquí los `.woff2`:

- **DM Mono**: [Google Fonts](https://fonts.google.com/specimen/DM+Mono) → descargar y extraer; copia los `.woff2` (p. ej. `DMMono-Light.woff2`, `DMMono-Regular.woff2`) como `dm-mono-300.woff2` y `dm-mono-400.woff2`.
- **Playfair Display**: [Google Fonts](https://fonts.google.com/specimen/Playfair+Display) → igual, copia como `playfair-400.woff2` y `playfair-700.woff2`.

Nombres esperados por `styles.css`:
- `dm-mono-300.woff2`, `dm-mono-400.woff2`
- `playfair-400.woff2`, `playfair-700.woff2`

Si no existen, la app usa el `@import` remoto (requiere red la primera vez).
