import React from "react";

interface FooterProps {
  isFocusMode: boolean;
}

export function Footer({ isFocusMode }: FooterProps) {
  if (isFocusMode) return null;

  return (
    // [UI-NONPROGRAMMER] Komponen Footer bawah halaman. Teks copyright bisa diubah di sini.
    <footer className="border-t border-neutral-900 bg-[#070708] py-4 px-6 text-center text-[11px] text-neutral-600 mt-auto" id="app-footer">
      &copy; {new Date().getFullYear()} RhythmPrompter. Dibuat dengan presisi untuk konten creator modern. All rights reserved.
    </footer>
  );
}
