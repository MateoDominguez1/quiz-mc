/**
 * Icona generica dell'app (punto interrogativo giallo su rosso).
 * Nessun logo ufficiale: sostituibile quando verrà fornito il materiale autorizzato.
 */
export function IconArt({ size, maskable = false }: { size: number; maskable?: boolean }) {
  const inner = maskable ? size * 0.62 : size * 0.78;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#da291c",
        borderRadius: maskable ? 0 : size * 0.22,
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffc72c",
          borderRadius: inner,
          color: "#da291c",
          fontSize: inner * 0.72,
          fontWeight: 900,
          lineHeight: 1,
          fontFamily: "sans-serif",
        }}
      >
        ?
      </div>
    </div>
  );
}
