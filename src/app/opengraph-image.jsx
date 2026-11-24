import { ImageResponse } from "next/og";

export const alt = "CipherBrief — cybersecurity intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          color: "#f4f5f7",
          background: "#171a20",
          fontFamily: "Arial",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px", color: "#b8f34a", fontSize: 24, fontWeight: 700, letterSpacing: 4 }}>
          <div style={{ width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #b8f34a", borderRadius: 10 }}>C</div>
          CIPHERBRIEF
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ color: "#b8d8c0", fontSize: 20, letterSpacing: 5 }}>EXPLORE · LEARN · SECURE</div>
          <div style={{ maxWidth: 950, fontSize: 68, lineHeight: 1.08, fontWeight: 700 }}>Cybersecurity knowledge, shared responsibly.</div>
        </div>
        <div style={{ color: "#a9b0bc", fontSize: 22 }}>Research · Practical guides · Community</div>
      </div>
    ),
    size,
  );
}
